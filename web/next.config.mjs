/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "@napi-rs/canvas", "pdfjs-dist"]
  }
};

export default nextConfig;
