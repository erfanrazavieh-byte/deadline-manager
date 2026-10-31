import type { MetadataRoute } from "next";

const siteUrl = "https://deadline-manager.erfan-dev.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
