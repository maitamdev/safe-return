import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/bounties", "/login", "/signup", "/t/"],
        disallow: ["/api/", "/setup", "/auth/", "/bounties/create", "/bounties/dashboard", "/bounties/arbitration"],
      },
    ],
    sitemap: `${site.replace(/\/$/, "")}/sitemap.xml`,
  };
}
