import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function gradeColor(grade: string): string {
  return {
    A: "text-emerald-500",
    B: "text-green-500",
    C: "text-yellow-500",
    D: "text-orange-500",
    F: "text-red-500",
  }[grade] ?? "text-gray-400";
}

export function pacingColor(category: string): string {
  return {
    slow:  "text-blue-400",
    ideal: "text-emerald-400",
    fast:  "text-orange-400",
  }[category] ?? "text-gray-400";
}

export function priorityBadge(priority: string): string {
  return {
    high:   "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    low:    "bg-gray-500/15 text-gray-400 border-gray-500/30",
  }[priority] ?? "bg-gray-500/15 text-gray-400";
}
