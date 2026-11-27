import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'RUPA EDU — Belajar. Menemukan. Berkarya. Berbagi.', template: '%s · RUPA EDU' },
  description: 'Ruang untuk menemukan, memahami, dan menciptakan pengetahuan. Cari tanpa perlu login.',
  icons: { icon: '/brand/rupa-mark.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF6EE' },
    { media: '(prefers-color-scheme: dark)', color: '#14161C' },
  ],
};

// Menetapkan tema sebelum halaman tampil agar tidak berkedip.
const themeInit = `(function(){try{var t=localStorage.getItem('rupa-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a href="#konten" className="skip-link">Lompat ke konten</a>
        {children}
      </body>
    </html>
  );
}
