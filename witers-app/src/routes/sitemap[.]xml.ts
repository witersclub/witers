import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const today = new Date().toISOString().split('T')[0]
        const pages = [
          { path: '/', priority: '1.0' },
          { path: '/registro', priority: '0.8' },
          { path: '/ingresar', priority: '0.5' },
        ]
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...pages.flatMap((p) => [
            '  <url>',
            `    <loc>${origin}${p.path === '/' ? '/' : p.path}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            '    <changefreq>weekly</changefreq>',
            `    <priority>${p.priority}</priority>`,
            '  </url>',
          ]),
          '</urlset>',
        ].join('\n')
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

