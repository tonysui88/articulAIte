"use client";

import { RotateCcw, Mic2, Zap, Brain, Clock } from "lucide-react";
import {
  cn,
  formatDuration,
  gradeColor,
  pacingColor,
  priorityBadge,
} from "@/lib/utils";
import type { AnalysisResult, ActionableTip, TranscriptWord } from "@/types/analysis";

interface Props {
  result:   AnalysisResult;
  onReset:  () => void;
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({
  icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon:            React.ReactNode;
  label:           string;
  value:           string;
  sub?:            string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <p className={cn("text-3xl font-bold tabular-nums", valueClassName ?? "text-white")}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  );
}

// ─── Tip card ─────────────────────────────────────────────────────────────────
function TipCard({ tip }: { tip: ActionableTip }) {
  const categoryIcon: Record<ActionableTip["category"], string> = {
    pacing:     "⏱",
    clarity:    "💡",
    structure:  "🏗",
    vocabulary: "📖",
    confidence: "💪",
  };

  return (
    <div className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-4 animate-slide-up">
      <span className="text-xl flex-shrink-0 mt-0.5">{categoryIcon[tip.category]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-semibold text-white">{tip.title}</h4>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              priorityBadge(tip.priority)
            )}
          >
            {tip.priority}
          </span>
        </div>
        <p className="text-xs text-white/55 leading-relaxed">{tip.detail}</p>
      </div>
    </div>
  );
}

// ─── Annotated transcript ─────────────────────────────────────────────────────
function AnnotatedTranscript({ words }: { words: TranscriptWord[] }) {
  if (words.length === 0) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-sm leading-8 font-mono text-white/70">
      {words.map((w, i) => (
        <span
          key={i}
          title={w.isFiller ? `Filler word: "${w.word}"` : undefined}
          className={cn(
            w.isFiller
              ? "bg-orange-500/20 text-orange-300 rounded px-0.5 mx-0.5 cursor-help underline decoration-dotted decoration-orange-400"
              : undefined
          )}
        >
          {i > 0 ? " " : ""}{w.word}
        </span>
      ))}
      {words.length > 0 && (
        <p className="mt-4 pt-3 border-t border-white/10 text-xs text-white/30 font-sans not-italic">
          <span className="inline-block w-3 h-3 bg-orange-500/20 border border-orange-400/40 rounded mr-1 align-middle" />
          Filler words are highlighted. Hover for details.
        </p>
      )}
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius      = 52;
  const stroke      = 8;
  const normalised  = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalised;
  const offset      = circumference - (score / 100) * circumference;

  const ringColor: Record<string, string> = {
    A: "#10b981", B: "#22c55e", C: "#eab308", D: "#f97316", F: "#ef4444",
  };

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle
          cx="64" cy="64" r={normalised}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx="64" cy="64" r={normalised}
          fill="none"
          stroke={ringColor[grade] ?? "#6b7280"}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold", gradeColor(grade))}>{grade}</span>
        <span className="text-xs text-white/40">{score}/100</span>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function ResultsDashboard({ result, onReset }: Props) {
  const { pacing, fillers, coherence, words, duration, transcript } = result;

  const fillerPercent =
    words.length > 0
      ? Math.round((fillers.totalCount / words.length) * 100)
      : 0;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Your Analysis</h2>
          <p className="text-xs text-white/35 mt-0.5">
            {formatDuration(duration)} recording · processed {new Date(result.processedAt).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={onReset}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
            "bg-white/10 hover:bg-white/15 text-white/70 hover:text-white",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          )}
        >
          <RotateCcw size={14} />
          New recording
        </button>
      </div>

      {/* Coherence score + grade */}
      <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-6">
        <ScoreRing score={coherence.score} grade={coherence.grade} />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-3">Coherence & Clarity</h3>
          {coherence.strengths.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Strengths</p>
              <ul className="space-y-0.5">
                {coherence.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-emerald-300 flex gap-1.5">
                    <span>✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {coherence.improvements.length > 0 && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Areas to improve</p>
              <ul className="space-y-0.5">
                {coherence.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-orange-300 flex gap-1.5">
                    <span>→</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          icon={<Clock size={12} />}
          label="Pace"
          value={`${pacing.wpm} WPM`}
          sub={pacing.category.charAt(0).toUpperCase() + pacing.category.slice(1)}
          valueClassName={pacingColor(pacing.category)}
        />
        <MetricCard
          icon={<Mic2 size={12} />}
          label="Filler words"
          value={String(fillers.totalCount)}
          sub={`${fillerPercent}% of words · ${fillers.fillerRate}/min`}
          valueClassName={
            fillers.totalCount === 0
              ? "text-emerald-400"
              : fillerPercent > 10
              ? "text-orange-400"
              : "text-yellow-400"
          }
        />
        <MetricCard
          icon={<Zap size={12} />}
          label="Duration"
          value={formatDuration(duration)}
          sub={`${words.length} words total`}
        />
      </div>

      {/* Filler breakdown */}
      {fillers.totalCount > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <Mic2 size={14} className="text-orange-400" />
            Filler word breakdown
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fillers.byWord)
              .sort((a, b) => b[1] - a[1])
              .map(([word, count]) => (
                <div
                  key={word}
                  className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 rounded-full px-3 py-1"
                >
                  <span className="text-xs font-mono text-orange-300">&ldquo;{word}&rdquo;</span>
                  <span className="text-xs text-white/40">×{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actionable tips */}
      {coherence.tips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <Brain size={14} className="text-brand-400" />
            Coaching tips
          </h3>
          <div className="flex flex-col gap-2">
            {coherence.tips.map((tip, i) => (
              <TipCard key={i} tip={tip} />
            ))}
          </div>
        </div>
      )}

      {/* Full transcript */}
      <div>
        <h3 className="text-sm font-semibold text-white/70 mb-3">
          Full transcript
          {words.length === 0 && (
            <span className="ml-2 text-xs text-white/30 font-normal">(word timings unavailable)</span>
          )}
        </h3>
        {words.length > 0
          ? <AnnotatedTranscript words={words} />
          : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-white/60 leading-relaxed">
              {transcript}
            </div>
          )
        }
      </div>
    </div>
  );
}
