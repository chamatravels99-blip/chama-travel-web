import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/driver/', '/login'],
    },
    sitemap: 'https://chamatravels.com/sitemap.xml',
  };
}
