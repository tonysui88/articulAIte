/**
 * POST /api/coach-open
 *
 * Returns the coach's opening line to kick off a roleplay session.
 * Called once when the user starts a new session (no audio required).
 */

import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { scenario, targetVocab } = await req.json() as {
      scenario:    string;
      targetVocab: string[];
    };

    if (!scenario?.trim()) {
      return Response.json({ success: false, error: "Scenario is required." }, { status: 400 });
    }

    // Use Flash for the cheap, fast opening call
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an elite Speaking Coach AI running a spoken-English roleplay.

SCENARIO: ${scenario}
TARGET VOCABULARY the user should practice: ${targetVocab.join(", ")}

Open the roleplay with a single, brief (1-3 sentences) in-character line that sets the scene and naturally invites the user to respond. Stay fully in character. Do not mention that this is a practice exercise.

Output ONLY your opening line — no preamble, no label, no quotation marks.`;

    const result  = await model.generateContent(prompt);
    const opening = result.response.text().trim();

    return Response.json({ success: true, data: { opening } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error.";
    console.error("[/api/coach-open]", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
