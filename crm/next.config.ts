import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    output: "standalone",
    allowedDevOrigins: ["127.0.0.1", "192.168.31.24", "100.91.51.92", "localhost"],
    async redirects() {
        return [
            {
                source: "/",
                destination: "/login",
                permanent: false,
            },
        ];
    },
    experimental: {
        serverActions: {
            bodySizeLimit: "110mb",
        },
    },
};
export default nextConfig;
