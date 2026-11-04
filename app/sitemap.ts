import type { MetadataRoute } from 'next';

const siteUrl = 'https://chamatravels.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    '',
    '/about',
    '/activities',
    '/booking',
    '/contact',
    '/destinations',
    '/gallery',
    '/services',
    '/tours',
  ];

  return publicPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'monthly',
    priority: path ? 0.8 : 1,
  }));
}
