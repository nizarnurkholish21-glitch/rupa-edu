/** Hanya izinkan pengalihan ke jalur internal agar tidak bisa dipakai untuk open redirect. */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return '/ruang';
  return next;
}
