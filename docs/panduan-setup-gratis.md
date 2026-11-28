# Panduan setup gratis (untuk non-developer)

Panduan ini membawa RUPA EDU online dengan layanan gratis. Tidak perlu memasang apa pun di komputer. Waktu: sekitar 30–45 menit.

> Tampilan situs Vercel dan Supabase bisa berubah sedikit dari waktu ke waktu. Jika nama tombol berbeda, cari menu dengan arti yang sama.

## Bagian A — Situs online di Vercel (tanpa database)

Hasil: situs bisa dibuka dari mana saja; pencarian berjalan dengan 12 artikel demo; login menampilkan "belum dikonfigurasi".

1. Buka https://vercel.com dan pilih **Sign Up** → **Continue with GitHub**. Pilih paket **Hobby** (gratis).
2. Klik **Add New… → Project**, lalu **Import** repositori `rupa-edu`. Jika repositori tidak muncul, klik *Adjust GitHub App Permissions* dan beri akses ke `rupa-edu`.
3. Framework akan terdeteksi otomatis sebagai **Next.js**. Jangan ubah pengaturan build.
4. Klik **Deploy**. Tunggu 1–3 menit sampai muncul tautan seperti `rupa-edu-xxxx.vercel.app`.
5. Buka tautan itu. Coba cari "warna komplementer" dan "batik".

Setiap kali kode baru masuk ke cabang `main` di GitHub, Vercel memperbarui situs secara otomatis.

## Bagian B — Database & login di Supabase

Hasil: login aktif, peran (siswa/guru/wali/admin) bekerja, aturan privasi ditegakkan database.

### B1. Buat proyek

1. Buka https://supabase.com → **Start your project** → masuk dengan GitHub.
2. **New project**. Isi:
   - Name: `rupa-edu`
   - Database Password: klik *Generate*, lalu **simpan di pengelola kata sandi** (jangan dikirim lewat chat).
   - Region: pilih **Southeast Asia (Singapore)** agar cepat dari Indonesia.
   - Plan: **Free**.
3. Tunggu sampai proyek siap (±2 menit).

### B2. Buat tabel dan aturan akses (sekali salin-tempel)

1. Di GitHub, buka berkas **`supabase/setup-lengkap.sql`**, lalu klik tombol **Copy raw file** (ikon dua kotak di kanan atas isi berkas).
2. Di Supabase, buka **SQL Editor** (ikon `>_` di menu kiri) → **New query**.
3. Klik area kosong, tekan **Ctrl+V** (Mac: Cmd+V), lalu klik **Run** (kanan bawah).
4. Harus muncul **"Success. No rows returned"**. Jika muncul peringatan tentang *destructive operation*, klik **Run this query**.

Berkas ini berisi semua tabel, aturan privasi, perpustakaan, dan 12 artikel demo. Jalankan **hanya sekali** di proyek yang masih kosong.

### B3. Matikan pendaftaran publik (penting)

Akun siswa dan guru dibuat oleh sekolah, bukan mendaftar sendiri.

1. **Authentication → Sign In / Providers** (atau *Settings*).
2. Matikan **Allow new users to sign up**.
3. Pastikan provider **Email** aktif.

### B4. Hubungkan ke Vercel

1. Di Supabase: **Project Settings → API** (atau *Data API*). Salin:
   - **Project URL**
   - **anon public** key
2. Di Vercel: buka proyek `rupa-edu` → **Settings → Environment Variables**. Tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
3. **Deployments** → titik tiga pada deployment teratas → **Redeploy**.
4. Buka `/status` di situs Anda: Supabase harus berstatus **Terhubung**.

> **Jangan** memasukkan *service_role key* ke Vercel. Kunci itu bisa melewati semua aturan privasi dan hanya dipakai untuk skrip akun demo.

## Bagian C — Jadikan akun Anda super admin

Akun pertama dibuat dari dashboard Supabase, lalu diberi peran super admin agar bisa mengunggah buku dan mengatur sekolah.

1. Supabase → **Authentication → Users → Add user → Create new user**. Isi email Anda dan kata sandi yang kuat; centang *Auto Confirm User*.
2. Buka **SQL Editor → New query**, tempel perintah berikut, ganti email-nya, lalu **Run**:

   ```sql
   insert into public.memberships (user_id, role)
   select id, 'super_admin' from auth.users where email = 'email-anda@contoh.com';
   ```

3. Masuk di situs Anda (`/masuk`). Menu **Perpustakaan → Kelola buku** sekarang tersedia.

## Bagian D — Memasukkan buku

Ikuti [panduan perpustakaan](perpustakaan.md): unggah tiap buku di **Kelola buku → Unggah buku**, tinjau bab, pilih sekolah, lalu tandai siap. Untuk mencoba sebagai guru/siswa, buat dulu sekolah demo (Bagian E).

## Bagian E — Akun demo (opsional)

Skrip `scripts/seed-demo-users.mjs` membuat satu sekolah demo beserta admin, guru, dua siswa, dan satu wali. Skrip ini perlu dijalankan oleh seseorang yang bisa memakai terminal (Node.js 20+). Jika belum ada, minta bantuan saya di sesi berikutnya atau mitra teknis Anda.

```bash
npm ci
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD='minimal-12-karakter' npm run seed:demo-users
```

Lalu login di `/masuk` dengan `guru@demo.rupa.edu`, `siswa1@demo.rupa.edu`, dan seterusnya.

## Yang perlu diingat soal paket gratis

| Layanan | Batas yang relevan |
| --- | --- |
| Vercel Hobby | Hanya untuk pemakaian pribadi/non-komersial ([kebijakan](https://vercel.com/docs/platform/fair-use-policy)) |
| Supabase Free | Database 500 MB, proyek dijeda setelah 1 minggu tidak aktif, tanpa backup otomatis ([harga](https://supabase.com/pricing)) |

Jika proyek Supabase dijeda, buka dashboard Supabase dan klik **Restore**. Sebelum ada data siswa sungguhan atau transaksi, tinjau ulang paket bersama mitra teknis dan konsultan hukum.
