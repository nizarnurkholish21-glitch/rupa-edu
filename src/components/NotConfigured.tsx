export function NotConfigured({ what }: { what: string }) {
  return (
    <div className="notice" role="status" style={{ marginTop: 24, maxWidth: '68ch' }}>
      <strong>Layanan akun belum dikonfigurasi</strong>
      {what} aktif setelah Supabase dihubungkan (lihat panduan setup di README repositori).
    </div>
  );
}
