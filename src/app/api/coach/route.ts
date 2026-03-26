/**
 * POST /api/coach
 *
 * Accepts a multipart/form-data body:
 *   audio       — WebM/Opus blob of the user's latest turn
 *   scenario    — string
 *   targetVocab — JSON-stringified string[]
 *   history     — JSON-stringified { role, content }[]
 *
 * Pipeline (single Gemini call):
 *  1. Transcribe the audio
 *  2. Evaluate grammar, phrasing, vocab usage vs. prior conversation
 *  3. Reply in-character
 *  4. Return structured XML parsed into clean JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ConversationTurn, CoachTurnResponse, CoachApiResponse } from "@/types/coach";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── XML helper ───────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re    = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "i");
  const match = xml.match(re);
  if (!match) return "";
  return match[0]
    .replace(new RegExp(`^<${tag}>`, "i"), "")
    .replace(new RegExp(`<\\/${tag}>$`, "i"), "")
    .trim();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<CoachApiResponse<CoachTurnResponse>>> {
  try {
    const formData    = await req.formData();
    const audioFile   = formData.get("audio");
    const scenario    = formData.get("scenario")    as string;
    const targetVocab = JSON.parse(formData.get("targetVocab") as string) as string[];
    const history     = JSON.parse(formData.get("history")     as string) as ConversationTurn[];

    if (!audioFile || !(audioFile instanceof Blob) || audioFile.size === 0) {
      return NextResponse.json({ success: false, error: "Missing audio." }, { status: 400 });
    }

    const MAX_BYTES = 20 * 1024 * 1024;
    if (audioFile.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Recording too long (20 MB max)." },
        { status: 413 }
      );
    }

    // Convert audio to base64 for Gemini inline data
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");
    const mimeType    = (audioFile.type || "audio/webm") as string;

    // Build conversation history context
    const historyText =
      history.length > 0
        ? history
            .map((t) => `${t.role === "coach" ? "COACH" : "USER"}: ${t.content}`)
            .join("\n")
        : "(Start of session — no prior turns.)";

    const prompt = `You are an elite, strict, but encouraging Speaking Coach AI driving a constraint-based language learning application.

YOUR MISSION: Engage the user in the roleplay scenario below while actively evaluating their spoken English transcript for vocabulary, grammar, and pragmatics.

CURRENT SCENARIO: ${scenario}
TARGET VOCABULARY: ${targetVocab.join(", ")}

RULES OF ENGAGEMENT:
- Keep your conversational replies brief (1-3 sentences) to force the user to do the majority of the speaking.
- Stay entirely in character for the <response>. Do not break the simulation or mention that this is a practice exercise.
- If the user makes a grammatical error, uses a clunky phrase, or misses an opportunity to use target vocabulary, flag it in <critique>.
- Be encouraging but precise — reference exact words/phrases the user said.

CONVERSATION HISTORY (most recent at the bottom):
${historyText}

The audio file attached is the USER's latest spoken turn. Transcribe it exactly, then evaluate it.

OUTPUT: You MUST respond using EXACTLY this XML structure. No text outside the tags.

<transcript>
Exact verbatim transcription of the audio.
</transcript>

<critique>
1-2 bullet points analyzing the user's turn just transcribed.
• Point out one specific grammatical or phrasing error and give the exact "Better way to say it: …"
• If they spoke perfectly, write "Perfect execution."
</critique>

<vocab_check>
Did the user naturally integrate any of the TARGET VOCABULARY (${targetVocab.join(", ")})?
Note which words they used (or missed) and whether the usage felt natural.
</vocab_check>

<response>
Your in-character reply to continue the roleplay (1-3 sentences max).
</response>`;

    const model  = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: audioBase64 } },
    ]);

    const raw = result.response.text();

    const userTranscript = extractTag(raw, "transcript");
    const critique       = extractTag(raw, "critique");
    const vocabCheck     = extractTag(raw, "vocab_check");
    const reply          = extractTag(raw, "response");

    if (!reply) {
      console.error("[/api/coach] XML parse failed. Raw:\n", raw.slice(0, 800));
      return NextResponse.json(
        { success: false, error: "Failed to parse coach response. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { userTranscript, critique, vocabCheck, reply },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[/api/coach]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
