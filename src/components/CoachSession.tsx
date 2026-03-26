"use client";

/**
 * CoachSession
 *
 * State machine:
 *   setup
 *     └─ startSession() ─▶  starting  (fetch opening line)
 *                               └─▶  coach_speaking  (TTS plays)
 *                                        └─▶  user_idle
 *                                                └─ startRecording() ─▶  recording
 *                                                                            └─ stopRecording() ─▶  processing
 *                                                                                                       └─▶  coach_speaking  (loop)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Volume2, VolumeX, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type CoachSetup,
  type ConversationTurn,
  type CoachTurnResponse,
  SCENARIO_PRESETS,
} from "@/types/coach";

type SessionPhase =
  | "setup"
  | "starting"
  | "coach_speaking"
  | "user_idle"
  | "recording"
  | "processing";

interface Props {
  onExit: () => void;
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

function useTTS() {
  const speak = useCallback((text: string, onEnd: () => void) => {
    if (typeof window === "undefined") { onEnd(); return; }
    window.speechSynthesis.cancel();

    const utterance  = new SpeechSynthesisUtterance(text);
    utterance.rate   = 0.92;
    utterance.pitch  = 1.05;
    utterance.volume = 1;

    // Fallback timer — Chrome has a known bug where onend never fires.
    // Estimate duration from word count at the chosen rate.
    const words       = text.trim().split(/\s+/).length;
    const estimatedMs = Math.max(2500, (words / 150) * 60_000 / utterance.rate) + 800;
    let   ended       = false;
    const fallback    = setTimeout(() => { if (!ended) { ended = true; onEnd(); } }, estimatedMs);

    const done = () => { if (!ended) { ended = true; clearTimeout(fallback); onEnd(); } };
    utterance.onend   = done;
    utterance.onerror = done;

    const doSpeak = () => {
      // Pick the best available English voice
      const voices    = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) =>
        ["Samantha", "Google US English", "Karen", "Moira"].some((n) => v.name.includes(n))
      ) ?? voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    };

    // Voices may not be loaded yet on first call — wait for voiceschanged
    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
      // Hard fallback: if voiceschanged never fires (some browsers), speak anyway
      setTimeout(doSpeak, 500);
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
  }, []);

  return { speak, cancel };
}

// ─── HUD Panel ────────────────────────────────────────────────────────────────

function HUDPanel({
  critique,
  vocabCheck,
  targetVocab,
}: {
  critique:    string;
  vocabCheck:  string;
  targetVocab: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "border border-white/10 rounded-2xl overflow-hidden transition-all duration-300",
        "bg-gray-950/80 backdrop-blur-sm animate-fade-in"
      )}
    >
      {/* HUD header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
            Live Coach Feedback
          </span>
        </div>
        <span className="text-white/30 text-xs">{collapsed ? "▼ show" : "▲ hide"}</span>
      </button>

      {!collapsed && (
        <div className="grid sm:grid-cols-2 gap-px bg-white/5">
          {/* Critique */}
          <div className="bg-gray-950 p-4">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">
              Critique
            </p>
            <div className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
              {critique || "—"}
            </div>
          </div>

          {/* Vocab check */}
          <div className="bg-gray-950 p-4">
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-2">
              Vocab Check
            </p>
            <div className="text-sm text-white/70 leading-relaxed mb-3">
              {vocabCheck || "—"}
            </div>
            {/* Vocab chips */}
            <div className="flex flex-wrap gap-1.5">
              {targetVocab.map((w) => {
                const used = vocabCheck.toLowerCase().includes(w.toLowerCase());
                return (
                  <span
                    key={w}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border font-mono",
                      used
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-white/5 text-white/30 border-white/10"
                    )}
                  >
                    {used ? "✓ " : ""}{w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Conversation bubble ──────────────────────────────────────────────────────

function Bubble({ turn }: { turn: ConversationTurn }) {
  const isCoach = turn.role === "coach";
  return (
    <div className={cn("flex gap-3 animate-slide-up", isCoach ? "justify-start" : "justify-end")}>
      {isCoach && (
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs">◎</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isCoach
            ? "bg-white/8 border border-white/10 text-white/85 rounded-tl-sm"
            : "bg-brand-600/25 border border-brand-500/30 text-white/85 rounded-tr-sm"
        )}
      >
        {turn.content}
      </div>
      {!isCoach && (
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs">🎤</span>
        </div>
      )}
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({
  onStart,
}: {
  onStart: (setup: CoachSetup) => void;
}) {
  const [scenario,      setScenario]     = useState("");
  const [vocabInput,    setVocabInput]   = useState("");
  const [targetVocab,   setTargetVocab]  = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const applyPreset = (i: number) => {
    const p = SCENARIO_PRESETS[i];
    setScenario(p.scenario);
    setTargetVocab(p.targetVocab);
    setVocabInput(p.targetVocab.join(", "));
    setSelectedPreset(i);
  };

  const handleVocabChange = (val: string) => {
    setVocabInput(val);
    setTargetVocab(
      val.split(",").map((w) => w.trim()).filter(Boolean)
    );
    setSelectedPreset(null);
  };

  const canStart = scenario.trim().length > 10 && targetVocab.length >= 1;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Presets */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Quick Start</p>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIO_PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={cn(
                "text-left p-3 rounded-xl border text-sm transition-all",
                selectedPreset === i
                  ? "border-brand-500/60 bg-brand-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
              )}
            >
              <span className="mr-2">{p.icon}</span>
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/8" />

      {/* Custom scenario */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-widest">
          Scenario <span className="text-white/25">(describe the scene)</span>
        </label>
        <textarea
          value={scenario}
          onChange={(e) => { setScenario(e.target.value); setSelectedPreset(null); }}
          rows={3}
          placeholder="e.g. You are pitching your startup idea to a skeptical investor…"
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3",
            "text-sm text-white/80 placeholder:text-white/25 resize-none",
            "focus:outline-none focus:border-brand-500/50 transition-colors"
          )}
        />
      </div>

      {/* Target vocabulary */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-widest">
          Target Vocabulary{" "}
          <span className="text-white/25">(comma-separated)</span>
        </label>
        <input
          value={vocabInput}
          onChange={(e) => handleVocabChange(e.target.value)}
          placeholder="e.g. leverage, benchmark, trajectory"
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3",
            "text-sm text-white/80 placeholder:text-white/25",
            "focus:outline-none focus:border-brand-500/50 transition-colors"
          )}
        />
        {targetVocab.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {targetVocab.map((w) => (
              <span
                key={w}
                className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30"
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={() => onStart({ scenario: scenario.trim(), targetVocab })}
        disabled={!canStart}
        className={cn(
          "w-full py-4 rounded-2xl font-semibold text-base transition-all duration-200",
          canStart
            ? "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30"
            : "bg-white/5 text-white/25 cursor-not-allowed"
        )}
      >
        Start Roleplay Session →
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoachSession({ onExit }: Props) {
  const [phase,    setPhase]    = useState<SessionPhase>("setup");
  const [setup,    setSetup]    = useState<CoachSetup | null>(null);
  const [history,  setHistory]  = useState<ConversationTurn[]>([]);
  const [hud,      setHud]      = useState<{ critique: string; vocabCheck: string } | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [muted,    setMuted]    = useState(false);

  const feedRef            = useRef<HTMLDivElement>(null);
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef          = useRef<Blob[]>([]);
  const streamRef          = useRef<MediaStream | null>(null);

  // Keep latest setup + history in refs to avoid stale closures in recorder callbacks
  const setupRef   = useRef(setup);
  const historyRef = useRef(history);
  useEffect(() => { setupRef.current   = setup; },   [setup]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const { speak, cancel } = useTTS();

  // Auto-scroll conversation feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [history]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cancel]);

  // ── TTS wrapper that respects mute ────────────────────────────────────────

  const maybeSpeakThenContinue = useCallback(
    (text: string) => {
      if (muted) {
        setPhase("user_idle");
        return;
      }
      setPhase("coach_speaking");
      speak(text, () => setPhase("user_idle"));
    },
    [muted, speak]
  );

  // ── Start session (fetch opening line) ────────────────────────────────────

  const startSession = useCallback(async (s: CoachSetup) => {
    setSetup(s);
    setPhase("starting");
    setError(null);
    try {
      const res  = await fetch("/api/coach-open", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scenario: s.scenario, targetVocab: s.targetVocab }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const opening = json.data.opening as string;
      setHistory([{ role: "coach", content: opening }]);
      maybeSpeakThenContinue(opening);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session.");
      setPhase("setup");
    }
  }, [maybeSpeakThenContinue]);

  // ── Submit user's audio turn to coach API ─────────────────────────────────

  const submitTurn = useCallback(async (blob: Blob) => {
    const currentSetup   = setupRef.current;
    const currentHistory = historyRef.current;
    if (!currentSetup) return;

    try {
      const formData = new FormData();
      formData.append("audio",       blob, "recording.webm");
      formData.append("scenario",    currentSetup.scenario);
      formData.append("targetVocab", JSON.stringify(currentSetup.targetVocab));
      formData.append("history",     JSON.stringify(
        currentHistory.map((t) => ({ role: t.role, content: t.content }))
      ));

      const res  = await fetch("/api/coach", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const { userTranscript, reply, critique, vocabCheck } = json.data as CoachTurnResponse;

      setHistory((prev) => [
        ...prev,
        { role: "user",  content: userTranscript, critique, vocabCheck },
        { role: "coach", content: reply },
      ]);
      setHud({ critique, vocabCheck });
      maybeSpeakThenContinue(reply);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setPhase("user_idle");
    }
  }, [maybeSpeakThenContinue]);

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        submitTurn(blob);
      };

      recorder.start(250);
      setPhase("recording");
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  }, [submitTurn]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setPhase("processing");
  }, []);

  // ── Toggle mute ───────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!muted) cancel(); // stop any playing TTS immediately
    setMuted((m) => !m);
    if (phase === "coach_speaking") setPhase("user_idle");
  }, [muted, cancel, phase]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Roleplay Coach</h2>
            <p className="text-xs text-white/40">Configure your scenario to begin</p>
          </div>
        </div>
        <SetupScreen onStart={startSession} />
      </div>
    );
  }

  // ── Session screen ────────────────────────────────────────────────────────

  const phaseLabel: Record<SessionPhase, string> = {
    setup:          "",
    starting:       "Starting session…",
    coach_speaking: "Coach is speaking…",
    user_idle:      "Your turn — press Record",
    recording:      "Recording… press Stop when done",
    processing:     "Analysing your response…",
  };

  const isUserTurn   = phase === "user_idle" || phase === "recording";
  const isProcessing = phase === "processing" || phase === "starting";

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 animate-fade-in">

      {/* Session header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            title="Exit session"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-white">Roleplay Session</h2>
            <p className="text-xs text-white/35 truncate max-w-[260px]">
              {setup?.scenario.slice(0, 60)}…
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            title={muted ? "Unmute coach" : "Mute coach"}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          {/* Restart */}
          <button
            onClick={() => {
              cancel();
              streamRef.current?.getTracks().forEach((t) => t.stop());
              setHistory([]);
              setHud(null);
              setError(null);
              setPhase("setup");
            }}
            title="Start over"
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-2">✕</button>
        </div>
      )}

      {/* Live HUD */}
      {hud && setup && (
        <HUDPanel
          critique={hud.critique}
          vocabCheck={hud.vocabCheck}
          targetVocab={setup.targetVocab}
        />
      )}

      {/* Conversation feed */}
      <div
        ref={feedRef}
        className="flex flex-col gap-3 overflow-y-auto max-h-[340px] px-1 py-2"
        style={{ scrollBehavior: "smooth" }}
      >
        {history.length === 0 && (
          <p className="text-center text-white/25 text-sm py-8">
            {isProcessing ? "Starting your session…" : "The coach will speak first."}
          </p>
        )}
        {history.map((turn, i) => (
          <Bubble key={i} turn={turn} />
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex gap-3 justify-start animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-xs">◎</span>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status + controls */}
      <div className="flex flex-col items-center gap-3 pt-2 border-t border-white/8">
        <p className={cn(
          "text-xs font-medium transition-colors",
          phase === "recording"      ? "text-red-400"
          : phase === "coach_speaking" ? "text-brand-400"
          : "text-white/40"
        )}>
          {phaseLabel[phase]}
        </p>

        {/* Record / Stop button */}
        <button
          onClick={phase === "recording" ? stopRecording : startRecording}
          disabled={!isUserTurn}
          className={cn(
            "relative w-16 h-16 rounded-full flex items-center justify-center",
            "transition-all duration-200 focus:outline-none",
            phase === "recording"
              ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/40"
              : isUserTurn
              ? "bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/30"
              : "bg-white/5 cursor-not-allowed"
          )}
          aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
        >
          {phase === "recording" && (
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
          )}
          {phase === "recording"
            ? <Square size={22} className="text-white fill-white" />
            : <Mic    size={22} className={cn("text-white", !isUserTurn && "opacity-30")} />
          }
        </button>

        {/* Vocab chips (always visible as reminder) */}
        {setup && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {setup.targetVocab.map((w) => (
              <span
                key={w}
                className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/25 border border-white/8"
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
