"use client";

/**
 * AudioRecorder
 *
 * Handles the full recording lifecycle:
 *   idle → recording → recorded → uploading → (result passed to parent)
 *
 * Uses the Web MediaRecorder API (WebM/Opus, supported in all modern browsers).
 * Renders a live waveform visualiser during recording using the Web Audio API.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { Mic, Square, RotateCcw, Send, AlertCircle } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { AnalysisResult } from "@/types/analysis";

type RecorderState = "idle" | "recording" | "recorded" | "uploading";

interface Props {
  onResult: (result: AnalysisResult) => void;
  onError:  (message: string) => void;
}

const WAVEFORM_BARS    = 48;
const MAX_DURATION_SEC = 300; // 5 min max

export default function AudioRecorder({ onResult, onError }: Props) {
  const [state,        setState]        = useState<RecorderState>("idle");
  const [elapsed,      setElapsed]      = useState(0);
  const [waveform,     setWaveform]     = useState<number[]>(Array(WAVEFORM_BARS).fill(0));
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const audioBlobRef     = useRef<Blob | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const animFrameRef     = useRef<number>(0);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);

  // ── Waveform animation ───────────────────────────────────────────────────
  const animateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser    = analyserRef.current;
    const bufferLen   = analyser.frequencyBinCount;
    const dataArray   = new Uint8Array(bufferLen);
    analyser.getByteFrequencyData(dataArray);

    const barsData = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const start = Math.floor((i / WAVEFORM_BARS) * bufferLen);
      const end   = Math.floor(((i + 1) / WAVEFORM_BARS) * bufferLen);
      const slice = dataArray.slice(start, end);
      const avg   = slice.reduce((s, v) => s + v, 0) / slice.length;
      return Math.min(100, (avg / 255) * 100);
    });

    setWaveform(barsData);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  }, []);

  // ── Start recording ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio analyser for waveform
      const audioCtx    = new AudioContext();
      const source      = audioCtx.createMediaStreamSource(stream);
      const analyser    = audioCtx.createAnalyser();
      analyser.fftSize  = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType    = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder    = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        audioBlobRef.current = new Blob(chunksRef.current, { type: mimeType });
        setState("recorded");
      };

      recorder.start(250); // collect chunks every 250ms
      setState("recording");
      setElapsed(0);
      animFrameRef.current = requestAnimationFrame(animateWaveform);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_DURATION_SEC) {
            stopRecording();
            return s + 1;
          }
          return s + 1;
        });
      }, 1000);

    } catch (err) {
      onError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone permissions and try again."
          : "Could not access microphone. Please check your browser settings."
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateWaveform, onError]);

  // ── Stop recording ───────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setWaveform(Array(WAVEFORM_BARS).fill(0));
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    audioBlobRef.current = null;
    chunksRef.current    = [];
    setElapsed(0);
    setUploadProgress(0);
    setWaveform(Array(WAVEFORM_BARS).fill(0));
    setState("idle");
  }, []);

  // ── Submit for analysis ──────────────────────────────────────────────────
  const submitForAnalysis = useCallback(async () => {
    const blob = audioBlobRef.current;
    if (!blob) return;

    setState("uploading");
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      setUploadProgress(30);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body:   formData,
      });

      setUploadProgress(90);

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Server error (${res.status})`);
      }

      setUploadProgress(100);
      onResult(json.data);

    } catch (err) {
      onError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setState("recorded"); // allow retry
      setUploadProgress(0);
    }
  }, [onResult, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const isRecording = state === "recording";
  const isRecorded  = state === "recorded";
  const isUploading = state === "uploading";

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto">

      {/* Waveform visualiser */}
      <div
        className={cn(
          "w-full h-24 flex items-end justify-center gap-[2px] rounded-2xl px-4",
          "bg-white/5 border border-white/10 transition-all duration-300",
          isRecording && "border-brand-500/50 shadow-lg shadow-brand-500/10"
        )}
        aria-label="Audio waveform visualisation"
        role="img"
      >
        {waveform.map((height, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              isRecording ? "bg-brand-400" : "bg-white/20"
            )}
            style={{ height: `${Math.max(4, height)}%` }}
          />
        ))}
      </div>

      {/* Timer */}
      <div
        className={cn(
          "font-mono text-3xl font-semibold tabular-nums transition-colors",
          isRecording ? "text-brand-400" : "text-white/40"
        )}
        aria-live="polite"
        aria-label={`Recording duration: ${formatDuration(elapsed)}`}
      >
        {formatDuration(elapsed)}
        {elapsed >= MAX_DURATION_SEC - 30 && isRecording && (
          <span className="ml-3 text-sm text-orange-400 font-normal font-sans animate-pulse">
            approaching limit
          </span>
        )}
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">

        {/* Record / Stop */}
        {(state === "idle" || state === "recording") && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "relative w-20 h-20 rounded-full flex items-center justify-center",
              "transition-all duration-200 focus:outline-none focus-visible:ring-2",
              "focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
              isRecording
                ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/40"
                : "bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/40"
            )}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
            )}
            {isRecording
              ? <Square  size={28} className="text-white fill-white" />
              : <Mic     size={28} className="text-white" />
            }
          </button>
        )}

        {/* Re-record */}
        {(isRecorded || isUploading) && (
          <button
            onClick={reset}
            disabled={isUploading}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              "bg-white/10 hover:bg-white/20 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            )}
            aria-label="Re-record"
          >
            <RotateCcw size={20} className="text-white/70" />
          </button>
        )}

        {/* Analyse */}
        {isRecorded && (
          <button
            onClick={submitForAnalysis}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full",
              "bg-brand-600 hover:bg-brand-500 text-white font-semibold",
              "shadow-lg shadow-brand-600/40 transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            )}
            aria-label="Analyse recording"
          >
            <Send size={18} />
            Analyse
          </button>
        )}

        {/* Uploading spinner */}
        {isUploading && (
          <div className="flex items-center gap-3 text-white/60">
            <svg
              className="animate-spin w-5 h-5 text-brand-400"
              fill="none" viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
              />
            </svg>
            <span className="text-sm">Analysing your speech…</span>
          </div>
        )}
      </div>

      {/* Hint text */}
      {state === "idle" && (
        <p className="text-sm text-white/35 text-center">
          Press the microphone button and start speaking naturally.
          <br />Aim for at least 30 seconds for the best analysis.
        </p>
      )}
      {isRecorded && (
        <p className="text-sm text-white/50 text-center">
          Recording saved ({formatDuration(elapsed)}).
          Hit <strong className="text-white/70">Analyse</strong> to get your feedback,
          or <strong className="text-white/70">re-record</strong> to try again.
        </p>
      )}
    </div>
  );
}

// ── Inline error banner (exported for reuse) ──────────────────────────────────
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 w-full max-w-xl mx-auto",
        "bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm",
        "animate-fade-in"
      )}
    >
      <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
      <p className="text-red-300 flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-300 font-medium ml-2"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
