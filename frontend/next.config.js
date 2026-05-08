/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // ✅ Cloudinary (production + dev)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dhtce8tnl/**",
      },
      // ✅ GitHub avatars
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      // ✅ Google avatars
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // ✅ localhost dev (anciennes photos en DB avant migration Cloudinary)
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1",
  },
};

module.exports = nextConfig;