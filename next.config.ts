import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Thumbnails are posted through a Server Action, so the 1MB default is
    // too small for the 5MB the bucket accepts plus multipart overhead.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
