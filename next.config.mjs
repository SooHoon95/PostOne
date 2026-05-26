/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native binaries (resvg) cannot be webpack-bundled
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
};

export default nextConfig;
