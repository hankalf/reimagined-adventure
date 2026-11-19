import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portal is almost entirely dynamic (per-employee, per-admin data), so we use the
  // classic dynamic rendering model rather than Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["exceljs", "nodemailer", "pg", "sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
