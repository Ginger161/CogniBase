import type { MetadataRoute } from 'next';

// Lets CogniBase be installed to the home screen and opened like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CogniBase',
    short_name: 'CogniBase',
    description: 'AI study and exam prep. Read, listen and revise from your own material.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0A0E1A',
    theme_color: '#0A0E1A',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
