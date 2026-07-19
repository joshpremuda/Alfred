import { pipeline, TextStreamer, type TextGenerationPipeline } from "@huggingface/transformers";
import type { ChatMessage } from "@/lib/db";

// A small instruct model that runs fully in-process (ONNX via Transformers.js) —
// no Ollama, no daemon, no API. A free stopgap when Claude credits aren't
// available. Override with LOCAL_MODEL for a larger/better model.
const MODEL = process.env.LOCAL_MODEL || "onnx-community/Qwen2.5-0.5B-Instruct";
const DTYPE = process.env.LOCAL_MODEL_DTYPE || "q4";
const MAX_NEW_TOKENS = Number(process.env.LOCAL_MAX_TOKENS || 512);

let genPromise: Promise<TextGenerationPipeline> | null = null;
function getGenerator(): Promise<TextGenerationPipeline> {
  if (!genPromise) {
    // Model weights download once on first use, then cache locally.
    genPromise = pipeline("text-generation", MODEL, {
      dtype: DTYPE as "q4" | "q8" | "fp16" | "fp32",
    }) as Promise<TextGenerationPipeline>;
  }
  return genPromise;
}

/**
 * Stream a reply from the local model. Bridges Transformers.js's TextStreamer
 * callback into an async generator so the chat route can stream it like Claude.
 * Yields a friendly message (never throws) if the model can't load.
 */
export async function* streamLocal(
  history: ChatMessage[],
  system: string,
): AsyncGenerator<string> {
  let generator: TextGenerationPipeline;
  try {
    generator = await getGenerator();
  } catch (err) {
    yield `[Local model unavailable: ${(err as Error).message}. Set LOCAL_MODEL in .env, or add Claude credits.]`;
    return;
  }

  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Bridge the streamer's synchronous callback to this async generator.
  const queue: string[] = [];
  let finished = false;
  let wake: (() => void) | null = null;
  const nudge = () => {
    wake?.();
    wake = null;
  };

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => {
      if (text) queue.push(text);
      nudge();
    },
  });

  const run = generator(messages, {
    max_new_tokens: MAX_NEW_TOKENS,
    do_sample: false,
    streamer,
  })
    .catch((err: unknown) => {
      queue.push(`\n[Local generation error: ${(err as Error).message}]`);
    })
    .finally(() => {
      finished = true;
      nudge();
    });

  while (!finished || queue.length) {
    if (queue.length) {
      yield queue.shift()!;
    } else {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  }
  await run;
}
