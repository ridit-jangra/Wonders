import type { MetadataRoute } from "next";
import { YSWS } from "@/lib/ysws-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/docs", "/w/"],
        disallow: ["/admin", "/api/", "/dashboard", "/login", "/onboarding", "/refers", "/r/"],
      },
    ],
    sitemap: `${YSWS.origin}/sitemap.xml`,
    host: YSWS.origin,
  };
}
