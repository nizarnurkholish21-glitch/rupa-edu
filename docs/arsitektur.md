# Arsitektur

RUPA EDU adalah *modular monolith*: satu aplikasi Next.js (TypeScript) di atas Supabase (PostgreSQL + Auth + Storage). Batas modul dijaga lewat folder dan skema database, sehingga modul bisa dipisah kelak bila skala menuntut.

```mermaid
flowchart TB
  U[Pengguna: browser & HP] --> APP
  subgraph APP[Aplikasi Next.js di Vercel]
    UI[UI & komponen per peran]
    API[Server Actions / Route Handlers<br/>validasi zod]
    SRCH[Search adapter]
    AI[AI orchestrator - Fase 3]
  end
  APP -->|anon key + sesi pengguna<br/>semua query lewat RLS| SB
  subgraph SB[Supabase]
    PG[(PostgreSQL + RLS<br/>pg_trgm, full-text 'indonesian')]
    AUTH[Auth]
    ST[Storage privat - Fase 2]
  end
  AI -.-> CLAUDE[Claude API]
  SRCH -.-> EXT[Sumber terbuka & search API - Fase 6]
```

## Aturan keamanan inti

- Aplikasi web hanya memakai **anon key** + sesi pengguna. Setiap query tunduk pada Row-Level Security.
- **Service role key** tidak pernah dipakai oleh aplikasi web; hanya oleh skrip admin di luar web (mis. akun demo).
- Penulisan jejak audit hanya lewat fungsi `log_event()`; aktor diambil dari sesi, bukan dari klien.
- Fungsi pembantu policy berjalan `security definer` dengan `search_path` kosong untuk mencegah rekursi RLS dan pembajakan schema.

## Model data (Fase 1)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1 (dibuat otomatis)"
  PROFILES ||--o{ MEMBERSHIPS : memiliki
  SCHOOLS ||--o{ MEMBERSHIPS : "tenant"
  SCHOOLS ||--o{ ACADEMIC_YEARS : ""
  SCHOOLS ||--o{ CLASSES : ""
  ACADEMIC_YEARS ||--o{ CLASSES : ""
  CLASSES ||--o{ CLASS_TEACHERS : ""
  PROFILES ||--o{ CLASS_TEACHERS : "guru"
  CLASSES ||--o{ ENROLLMENTS : ""
  PROFILES ||--o{ ENROLLMENTS : "siswa"
  PROFILES ||--o{ GUARDIAN_LINKS : "wali / anak"
  PROFILES ||--o{ CONSENT_RECORDS : "subjek / pemberi"
  SCHOOLS ||--o{ AUDIT_LOGS : ""
  PUBLIC_ITEMS {
    text slug
    text title
    text summary
    content_kind kind
    text source_name
    text license
    bool is_demo
    bool published
    tsvector search
  }
```

| Peran | Melihat |
| --- | --- |
| Pengunjung (anon) | Hanya `public_items` yang terbit |
| Siswa | Profil sendiri, guru kelasnya, kelas yang diikuti, baris pendaftarannya sendiri |
| Guru | Kelas yang diampu dan siswa di kelas itu |
| Wali | Anak yang terhubung, kelas dan pendaftarannya |
| Admin sekolah | Semua data sekolahnya, jejak audit sekolahnya; bisa mengelola tahun ajaran, kelas, pendaftaran |
| Super admin | Semua sekolah |

Semua aturan di atas diuji otomatis di `tests/db/rls.test.ts`.

Domain berikutnya (perpustakaan, penilaian, AI, kehadiran, karya, pengetahuan, marketplace) ditambahkan sebagai migration baru per fase; lihat dokumen Tahap 0.
