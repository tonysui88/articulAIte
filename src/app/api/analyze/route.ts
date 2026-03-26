/**
 * POST /api/analyze
 *
 * Accepts a multipart/form-data body with an "audio" field (WebM/Opus blob).
 *
 * Pipeline:
 *  1. Parse the audio blob from form data
 *  2. Send to Gemini 1.5 Pro as inline base64 audio
 *  3. Gemini returns a single JSON object with transcript, pacing,
 *     filler analysis, word timings, and coherence feedback
 *  4. Return unified AnalysisResult JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult, AnalyzeResponse } from "@/types/analysis";
import { FILLER_WORDS } from "@/lib/analysisEngine";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ANALYSIS_PROMPT = `You are an expert speech analysis API. Analyze the provided audio recording.

Return ONLY a single valid JSON object — no markdown fences, no explanation — matching this exact schema:

{
  "transcript": "<full verbatim transcription>",
  "duration": <total duration in seconds as a number>,
  "words": [
    { "word": "<word>", "start": <start seconds>, "end": <end seconds>, "isFiller": <true|false> }
  ],
  "pacing": {
    "wpm": <words per minute as integer, excluding filler words>,
    "category": <"slow" if wpm<120 | "ideal" if 120-160 | "fast" if >160>
  },
  "fillers": {
    "totalCount": <integer>,
    "fillerRate": <fillers per minute, 1 decimal>,
    "byWord": { "<filler>": <count> },
    "topFiller": <most frequent filler string or null>
  },
  "coherence": {
    "score": <integer 0-100>,
    "grade": <"A"|"B"|"C"|"D"|"F">,
    "strengths": [<up to 3 specific strengths>],
    "improvements": [<up to 3 specific areas to improve>],
    "tips": [
      {
        "category": <"pacing"|"clarity"|"structure"|"vocabulary"|"confidence">,
        "title": <short imperative phrase, max 8 words>,
        "detail": <1-2 sentence actionable advice>,
        "priority": <"high"|"medium"|"low">
      }
    ]
  }
}

Filler words to detect: ${[...FILLER_WORDS].join(", ")}.

Coherence scoring rubric:
- Logical flow and structure (30 pts)
- Clarity of main idea (25 pts)
- Vocabulary and word choice (20 pts)
- Conciseness / lack of rambling (15 pts)
- Confidence markers (10 pts)

Provide 3-5 tips sorted high → low priority. Reference actual phrases from the transcript where helpful.`;

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // 1. Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'audio' field in form data." },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "Audio file is empty." },
        { status: 400 }
      );
    }

    // Gemini inline data limit is ~20 MB
    const MAX_BYTES = 20 * 1024 * 1024;
    if (audioFile.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Audio exceeds 20 MB limit. Please record a shorter clip." },
        { status: 413 }
      );
    }

    // 2. Convert to base64 for Gemini inline data
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");
    const mimeType    = (audioFile.type || "audio/webm") as string;

    // 3. Send to Gemini — single call handles transcription + analysis
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const geminiResult = await model.generateContent([
      { text: ANALYSIS_PROMPT },
      { inlineData: { mimeType, data: audioBase64 } },
    ]);

    const rawContent = geminiResult.response.text().trim();

    // Strip markdown code fences if Gemini includes them despite instructions
    const jsonStr = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    // 4. Parse and validate
    let parsed: AnalysisResult;
    try {
      parsed = JSON.parse(jsonStr) as AnalysisResult;
    } catch {
      console.error("[/api/analyze] JSON parse failed. Raw response:", rawContent.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response. Please try again." },
        { status: 502 }
      );
    }

    if (!parsed.transcript?.trim()) {
      return NextResponse.json(
        { success: false, error: "No speech detected. Please try again with clearer audio." },
        { status: 422 }
      );
    }

    // 5. Return with server timestamp
    return NextResponse.json({
      success: true,
      data: { ...parsed, processedAt: new Date().toISOString() },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[/api/analyze]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
