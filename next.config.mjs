/** @type {import('next').NextConfig} */
const nextConfig = {
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
