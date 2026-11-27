// Satu sumber nilai desain: design/tokens.json (salinan design system RUPA EDU).
// Skrip ini menghasilkan src/styles/tokens.css. Jalankan ulang setiap kali tokens.json berubah.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const t = JSON.parse(readFileSync(join(root, 'design/tokens.json'), 'utf8'));
const themes = t.color.themes.map((x) => x.id);
const val = (v, th) => {
  const raw = typeof v === 'string' ? v : (v[th] ?? v[themes[0]]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
};
const colorBlock = (th) => t.color.tokens.map((c) => `  --${c.name}: ${val(c.value, th)};`).join('\n');
const scalars = [...t.spacing.tokens, ...t.radius.tokens].map((x) => `  --${x.name}: ${x.value};`).join('\n');
const fams = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`).join('\n');
const faces = t.type.fonts.map((f) => `@font-face {\n  font-family: "${f.family}";\n  src: url("/fonts/${f.file.split('/').pop()}") format("woff2");\n  font-weight: ${f.weight};\n  font-style: ${f.style ?? 'normal'};\n  font-display: swap;\n}`).join('\n');
const styles = t.type.groups.flatMap((g) => g.styles.map((s) => {
  const fam = s.family ?? g.family;
  return `.t-${s.name} {\n  font-family: var(--font-${fam});\n  font-size: ${s.fontSize};\n  line-height: ${s.lineHeight};\n  font-weight: ${s.fontWeight};${s.letterSpacing ? `\n  letter-spacing: ${s.letterSpacing};` : ''}\n}`;
})).join('\n');

const css = `/* RUPA EDU — dibuat otomatis dari design/tokens.json oleh scripts/build-tokens.mjs. Jangan diedit manual. */
${faces}

:root, [data-theme="${themes[0]}"] {
  color-scheme: light;
${colorBlock(themes[0])}
}
${themes.slice(1).map((th) => `[data-theme="${th}"] {\n  color-scheme: ${th};\n${colorBlock(th)}\n}`).join('\n')}
:root {
${scalars}
${fams}
}
${styles}
`;
writeFileSync(join(root, 'src/styles/tokens.css'), css);
console.log('tokens.css dibuat');
