import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/customer/', '/driver/', '/login', '/register'],
    },
    sitemap: 'https://chamatravels.com/sitemap.xml',
  };
}
