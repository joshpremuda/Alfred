'use strict';
// Design Agent — generates on-brand Smalley Coffee graphics via Fal.ai FLUX

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

let _ai;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

const BRAND_CONTEXT = `Brand: Smalley Coffee, Jasper Indiana, craft roaster since 2014.
Aesthetic: Rat Pack / Palm Springs mid-century modern meets golf culture and craft coffee.
Color palette: warm neutrals, deep greens, sand, cognac brown, occasional coral accent.
Typography feel: clean, confident, slightly retro. Never trendy or millennial-minimalist.
Mood: sophisticated without being stuffy. Like a well-dressed man who also knows his single-origin.
Always reference Smalley Coffee brand identity.`;

// ── Parse design request ──────────────────────────────────────────────────
async function parseDesignRequest(userMessage) {
  const msg = await getAI().messages.create({
    model: process.env.HAIKU_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: 'Extract design request details. Reply with JSON only: {"type":"social post|bag mockup|menu|one-pager|ad|other","subject":"brief description of content"}',
    messages: [{ role: 'user', content: userMessage }],
  });
  try {
    const raw = msg.content[0]?.text || '{}';
    return JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch {
    return { type: 'social post', subject: userMessage };
  }
}

// ── Build FLUX prompt ─────────────────────────────────────────────────────
async function buildFluxPrompt({ type, subject, styleNotes = '' }) {
  const msg = await getAI().messages.create({
    model: process.env.SONNET_MODEL || 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `You are a creative director building image generation prompts.
${BRAND_CONTEXT}
Write a detailed, vivid Fal.ai FLUX prompt for the requested design.
Include: composition, color palette, mood, style references, typography direction.
Keep it under 200 words. Do not include negative prompts or parameters — just the prompt text.`,
    messages: [{
      role: 'user',
      content: `Design request: ${type} for "${subject}"\n${styleNotes ? `Style notes: ${styleNotes}` : ''}`
    }],
  });
  return msg.content[0]?.text || '';
}

// ── Generate image via Fal.ai ─────────────────────────────────────────────
async function generateImage(prompt) {
  if (!process.env.FAL_API_KEY) {
    throw new Error('FAL_API_KEY not configured');
  }
  const res = await axios.post(
    'https://fal.run/fal-ai/flux/schnell',
    {
      prompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
    },
    {
      headers: {
        Authorization: `Key ${process.env.FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );
  const images = res.data?.images || [];
  if (!images.length) throw new Error('No images returned from Fal.ai');
  return images[0].url;
}

// ── Main design flow ──────────────────────────────────────────────────────
async function createDesign(userMessage, styleNotes = '') {
  const { type, subject } = await parseDesignRequest(userMessage);
  const prompt = await buildFluxPrompt({ type, subject, styleNotes });
  const imageUrl = await generateImage(prompt);
  return { imageUrl, prompt, type, subject };
}

module.exports = { createDesign, buildFluxPrompt, generateImage };
