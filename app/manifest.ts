import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wonders, a Hack Club YSWS",
    short_name: "Wonders",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#F8F7E8",
    theme_color: "#5aa8a8",
    icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }],
  };
}
