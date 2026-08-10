import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Toastie',
    short_name: 'Toastie',
    description: 'Club management for Toastmasters clubs — meetings, education, and members.',
    start_url: '/',
    display: 'standalone',
    // Matches globals.css's `--background` / antd's `colorBgLayout`.
    background_color: '#fafafa',
    // Matches antd's `colorPrimary` / globals.css's `--foreground`.
    theme_color: '#1c1c1c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
