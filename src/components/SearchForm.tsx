// Formulir pencarian biasa (GET /cari?q=...) — bekerja tanpa JavaScript.
export function SearchForm({ defaultValue = '', hero = false, autoFocus = false }: { defaultValue?: string; hero?: boolean; autoFocus?: boolean }) {
  const id = hero ? 'cari-hero' : 'cari-header';
  return (
    <form action="/cari" method="get" role="search" className={`search-form${hero ? ' is-hero' : ''}`}>
      <label htmlFor={id} className="sr-only">Cari pengetahuan</label>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={hero ? 'Apa yang ingin kamu ketahui hari ini?' : 'Cari topik, konsep, teknik…'}
        maxLength={200}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
      <button type="submit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className={hero ? '' : 'sr-only'}>Cari</span>
      </button>
    </form>
  );
}
