"use client";

import { useState, useCallback } from "react";
import AudioRecorder, { ErrorBanner } from "@/components/AudioRecorder";
import ResultsDashboard               from "@/components/ResultsDashboard";
import CoachSession                   from "@/components/CoachSession";
import type { AnalysisResult }        from "@/types/analysis";
import { cn }                         from "@/lib/utils";

type Mode     = "analyse" | "coach";
type AppState = "idle" | "results";

export default function Home() {
  const [mode,     setMode]     = useState<Mode>("analyse");
  const [appState, setAppState] = useState<AppState>("idle");
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const handleResult = useCallback((r: AnalysisResult) => {
    setResult(r);
    setAppState("results");
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setAppState("idle");
    setError(null);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    handleReset();
  };

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-brand-400 text-lg">◎</span>
            <span className="font-semibold tracking-tight">
              articul<span className="text-brand-400">AI</span>te
            </span>
          </div>

          {/* Mode switcher */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
            {(["analyse", "coach"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 capitalize",
                  mode === m
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {m === "analyse" ? "📊 Analyse" : "🎭 Coach"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-12 gap-8">

        {/* ── Analyse mode ───────────────────────────────────────────────── */}
        {mode === "analyse" && (
          <>
            {appState === "idle" && (
              <div className="text-center max-w-lg animate-fade-in">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
                  Speak better,{" "}
                  <span className="text-brand-400">every time</span>.
                </h1>
                <p className="text-white/50 text-base leading-relaxed">
                  Record a 30-second answer, pitch, or idea.
                  Our AI will analyse your pacing, filler words, and structure
                  — and give you specific tips to improve.
                </p>
              </div>
            )}

            {error && (
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
            )}

            <div className="w-full max-w-2xl">
              {appState === "idle" && (
                <AudioRecorder
                  onResult={handleResult}
                  onError={setError}
                />
              )}
              {appState === "results" && result && (
                <ResultsDashboard result={result} onReset={handleReset} />
              )}
            </div>
          </>
        )}

        {/* ── Coach mode ─────────────────────────────────────────────────── */}
        {mode === "coach" && (
          <div className="w-full max-w-2xl animate-fade-in">
            {appState === "idle" && (
              <div className="text-center max-w-lg mx-auto mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
                  Practice with an{" "}
                  <span className="text-brand-400">AI coach</span>.
                </h1>
                <p className="text-white/50 text-base leading-relaxed">
                  Pick a scenario, choose target vocabulary, and roleplay a real-world conversation.
                  The coach critiques every turn in real time.
                </p>
              </div>
            )}
            <CoachSession onExit={() => switchMode("analyse")} />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-4 text-center">
        <p className="text-xs text-white/20">
          Audio is processed in memory and never stored. · Powered by Gemini
        </p>
      </footer>
    </main>
  );
}

