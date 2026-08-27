import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';

const routes = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/on-air', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/chat', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/captains-calendar', changeFrequency: 'daily', priority: 0.9 },
  { path: '/underwriting', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/donate', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.7 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${siteConfig.siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
