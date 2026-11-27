import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { SearchForm } from './SearchForm';
import { ThemeToggle } from './ThemeToggle';

export async function Header({ query = '', showSearch = true }: { query?: string; showSearch?: boolean }) {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="container bar">
        <Link href="/" className="brand" aria-label="RUPA EDU, ke beranda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-light" src="/brand/rupa-logo.svg" alt="" width={123} height={32} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-dark" src="/brand/rupa-logo-dark.svg" alt="" width={123} height={32} />
        </Link>
        <div className="header-search">{showSearch ? <SearchForm defaultValue={query} /> : null}</div>
        <nav className="header-nav" aria-label="Navigasi utama">
          <Link href="/cakupan" className="hide-sm">Cakupan</Link>
          {user ? <Link href="/ruang">Ruang saya</Link> : <Link href="/masuk">Masuk</Link>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
