import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow Server Actions to work in GitHub Codespaces and dev containers
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.app.github.dev',
        '*.githubpreview.dev',
      ],
    },
  },
};

export default nextConfig;
