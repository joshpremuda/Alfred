/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project so a stray package-lock.json in the
  // home directory can't make Next infer the wrong root (which broke `next start`
  // under launchd and caused the multiple-lockfiles warning).
  outputFileTracingRoot: import.meta.dirname,
  // Native / heavy CJS packages that must not be bundled by the server compiler.
  serverExternalPackages: [
    "better-sqlite3",
    "@huggingface/transformers",
    "onnxruntime-node",
    "jsdom",
    "pdf-parse",
    "@mozilla/readability",
  ],
};

export default nextConfig;
