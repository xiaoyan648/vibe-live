/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(process.env.NEXT_OUTPUT === "export" ? { output: "export" } : {}),
};

export default nextConfig;
