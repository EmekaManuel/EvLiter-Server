import { Router } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { carRecognitionRouter } from "./ai/carRecognition.js";
import { carAdvisorRouter } from "./ai/carAdvisor.js";

export const router = Router();

const requestSchema = z.object({
  prompt: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

router.post("/chat", async (req, res) => {
  const parse = requestSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  const { prompt, messages, model, temperature } = parse.data;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    const effectiveModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

    // Prefer chat messages if provided; otherwise build a simple user message from prompt
    const chatMessages =
      messages ?? (prompt ? [{ role: "user" as const, content: prompt }] : []);
    if (chatMessages.length === 0) {
      return res
        .status(400)
        .json({ error: "Provide either messages[] or prompt" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: effectiveModel,
      messages: chatMessages,
      temperature,
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    return res.json({ reply: content, model: effectiveModel });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "OpenAI request failed", message });
  }
});

// Car recognition routes
router.use("/car-recognition", carRecognitionRouter);

// Car advisor routes
router.use("/advisor", carAdvisorRouter);
