import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "down-sg.img.susercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.ebayimg.com",
      },
    ],
  },
};

export default nextConfig;
