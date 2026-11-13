import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';

export const ai = new GoogleGenAI({ apiKey });

export async function analyzeTaskWithGemini(text: string) {
  const model = process.env.GEMINI_MODEL_TEXT || 'gemini-2.5-flash';
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze task description and extract required skills, difficulty (1-5), and estimated hours: ${text}`
  });
  return response.text;
}

export async function embedText(text: string) {
  const model = process.env.GEMINI_MODEL_EMBED || 'text-embedding-004';
  const response = await ai.models.embedContent({
    model,
    contents: text
  });
  return response.embeddings;
}
