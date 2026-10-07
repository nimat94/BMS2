import type { MetadataRoute } from 'next';

// Позволяет «Добавить на главный экран» — приложение открывается как обычное, без браузера
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Контроль монтажа — МФК Фрунзенская наб.',
    short_name: 'Монтаж',
    description: 'Учёт монтажа кабелей, оборудования, щитов и посещаемости объекта',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#1e3a8a',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
