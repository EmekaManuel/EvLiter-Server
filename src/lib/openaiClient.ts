import OpenAI from "openai";

export function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
