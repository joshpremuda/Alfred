import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Download model weights from the HF hub on first use; cache locally afterwards.
env.allowRemoteModels = true;

const MODEL = process.env.EMBED_MODEL || "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Embed one string → a unit-normalized Float32 vector. */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Float32Array.from(output.data as Float32Array);
}

// Serialization helpers live in lib/vector.ts (pure, model-free). Re-export for
// existing import sites.
export { vecToBlob, blobToVec } from "@/lib/vector";
