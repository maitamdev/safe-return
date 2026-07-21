import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/bounties`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${site}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site}/setup`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
