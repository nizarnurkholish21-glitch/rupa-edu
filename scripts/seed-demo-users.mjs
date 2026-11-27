// Membuat akun DEMO di proyek Supabase Anda: satu sekolah demo, satu admin, satu guru,
// dua siswa, satu wali. Semua ditandai demo. Jangan dijalankan di proyek yang berisi data nyata.
//
// Pakai:  DEMO_PASSWORD='kata-sandi-panjang-anda' npm run seed:demo-users
// Butuh:  NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di environment (.env.local tidak dibaca otomatis).
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;

if (!url || !serviceKey) {
  console.error('Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.');
  process.exit(1);
}
if (!password || password.length < 12) {
  console.error('Isi DEMO_PASSWORD minimal 12 karakter. Kata sandi tidak disimpan di kode.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const PEOPLE = [
  { key: 'admin', email: 'admin@demo.rupa.edu', name: 'Admin Demo', role: 'school_admin' },
  { key: 'guru', email: 'guru@demo.rupa.edu', name: 'Guru Demo', role: 'teacher' },
  { key: 'siswa1', email: 'siswa1@demo.rupa.edu', name: 'Siswa Demo 1', role: 'student' },
  { key: 'siswa2', email: 'siswa2@demo.rupa.edu', name: 'Siswa Demo 2', role: 'student' },
  { key: 'wali', email: 'wali@demo.rupa.edu', name: 'Wali Demo', role: 'guardian' },
];

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(p) {
  const existing = await findUserByEmail(p.email);
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({
    email: p.email, password, email_confirm: true, user_metadata: { display_name: p.name },
  });
  if (error) throw new Error(`buat akun ${p.email}: ${error.message}`);
  return data.user.id;
}

const school = await must(
  db.from('schools').upsert({ name: 'Sekolah Demo RUPA', slug: 'sekolah-demo-rupa', is_demo: true }, { onConflict: 'slug' }).select().single(),
  'sekolah',
);
const ids = {};
for (const p of PEOPLE) {
  ids[p.key] = await ensureUser(p);
  await must(db.from('profiles').update({ is_demo: true }).eq('id', ids[p.key]), `profil ${p.key}`);
  const { error } = await db.from('memberships').insert({ user_id: ids[p.key], school_id: school.id, role: p.role });
  if (error && !/duplicate key/.test(error.message)) throw new Error(`keanggotaan ${p.key}: ${error.message}`);
}

const year = await must(
  db.from('academic_years').upsert({ school_id: school.id, label: '2026/2027', starts_on: '2026-07-13', ends_on: '2027-06-25' }, { onConflict: 'school_id,label' }).select().single(),
  'tahun ajaran',
);
let kelas = (await must(db.from('classes').select('id').eq('school_id', school.id).eq('name', '7A Demo').limit(1), 'cek kelas'))[0];
if (!kelas) {
  kelas = await must(db.from('classes').insert({ school_id: school.id, academic_year_id: year.id, name: '7A Demo', grade: 7, subject: 'Seni Rupa' }).select().single(), 'kelas');
}
await must(db.from('class_teachers').upsert({ class_id: kelas.id, user_id: ids.guru }), 'guru kelas');
await must(db.from('enrollments').upsert([{ class_id: kelas.id, student_id: ids.siswa1 }, { class_id: kelas.id, student_id: ids.siswa2 }]), 'pendaftaran');
await must(db.from('guardian_links').upsert({ guardian_id: ids.wali, student_id: ids.siswa1, school_id: school.id, verified_at: new Date().toISOString() }), 'wali');

console.log('Akun demo siap. Login dengan salah satu email berikut dan DEMO_PASSWORD Anda:');
for (const p of PEOPLE) console.log(`  ${p.email}  (${p.role})`);
