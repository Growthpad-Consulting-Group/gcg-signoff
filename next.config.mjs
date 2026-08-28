/** @type {import('next').NextConfig} */
const nextConfig = {
    agentRules: false,
    // sharp ships a native binary — keep it out of the serverless bundle and loaded at runtime
    // instead, the standard fix for using it in Next.js route handlers on Vercel.
    serverExternalPackages: ["sharp"],
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    },
};

export default nextConfig;