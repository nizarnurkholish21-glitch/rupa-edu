/** Cuplikan dari database: kata yang cocok ditandai « » oleh ts_headline. */
export function Snippet({ text }: { text: string }) {
  return <>{text.split(/«|»/).map((part, j) => (j % 2 === 1 ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>))}</>;
}
