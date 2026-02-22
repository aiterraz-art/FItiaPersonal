"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CalorieArcProps {
    current: number;    // This will be Consumed
    planned: number;    // This will be Total Planned for the day
    target: number;     // This is the daily budget/goal
}

export function CalorieArc({ current, planned, target }: CalorieArcProps) {
    const consumedPercentage = Math.min((current / target) * 100, 100);
    const plannedPercentage = Math.min((planned / target) * 100, 100);

    return (
        <div className="relative flex flex-col items-center justify-center pt-2 pb-6 px-4">
            <svg className="w-full max-w-[320px] h-auto aspect-2/1" viewBox="0 -8 120 62">
                <defs>
                    <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d946ef" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="plannedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d946ef" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                    </linearGradient>
                    <filter id="softGlow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" /><feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Background track */}
                <path
                    d="M 10,50 A 50,50 0 0,1 110,50"
                    fill="none"
                    stroke="rgba(139,92,246,0.05)"
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                {/* Planned Progress Arc (Ghostly) */}
                <path
                    d="M 10,50 A 50,50 0 0,1 110,50"
                    fill="none"
                    stroke="url(#plannedGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="157"
                    style={{
                        strokeDashoffset: 157 - (157 * plannedPercentage) / 100,
                        transition: "stroke-dashoffset 2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                />
                {/* Consumed Progress Arc (Main) */}
                <path
                    d="M 10,50 A 50,50 0 0,1 110,50"
                    fill="none"
                    stroke="url(#arcGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="157"
                    filter="url(#softGlow)"
                    style={{
                        strokeDashoffset: 157 - (157 * consumedPercentage) / 100,
                        transition: "stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                />
            </svg>
            <div className="absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-full">
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-baseline gap-1.5 translate-y-1">
                        <span className={cn(
                            "font-black tracking-tighter bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent leading-none",
                            current > 9999 ? "text-3xl" : "text-5xl"
                        )}>
                            {new Intl.NumberFormat().format(current)}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-zinc-500 font-black text-[10px] uppercase tracking-widest leading-none">Kcal</span>
                            <span className="text-zinc-600 font-bold text-[8px] uppercase tracking-tighter leading-none mt-0.5">consumidas</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest opacity-60">Plan</span>
                            <span className="text-xs text-zinc-300 font-black tracking-tight">{new Intl.NumberFormat().format(planned)}</span>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest opacity-60">Meta</span>
                            <span className="text-xs text-zinc-300 font-black tracking-tight">{new Intl.NumberFormat().format(target)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface MacroBarProps {
    label: string;
    current: number;
    planned: number;
    target: number;
}

export function MacroBar({ label, current, planned, target }: MacroBarProps) {
    const percentage = Math.min((current / target) * 100, 100);

    const gradientClass =
        label === "Proteínas" ? "bg-linear-to-r from-fuchsia-500 to-pink-500" :
            label === "Carbs" ? "bg-linear-to-r from-blue-500 to-cyan-400" :
                "bg-linear-to-r from-fuchsia-400 to-blue-300";

    const dotColor =
        label === "Proteínas" ? "bg-fuchsia-500" :
            label === "Carbs" ? "bg-blue-500" :
                "bg-fuchsia-400";

    return (
        <div className="flex-1 px-1.5 sm:px-3">
            <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">{label}</p>
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-lg", dotColor)} />
            </div>
            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-fuchsia-500/10">
                <div
                    className={cn("h-full rounded-full transition-all duration-1000", gradientClass)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="mt-2 flex flex-col overflow-hidden">
                <div className="flex items-baseline gap-0.5">
                    <span className={cn("font-black tracking-tighter truncate", current > 999 ? "text-[10px]" : "text-xs")}>{Math.round(current)}</span>
                    <span className="text-zinc-500 font-bold text-[8px] sm:text-[9px] opacity-60">/ {target}g</span>
                </div>
                <span className="text-zinc-600 font-black text-[8px] uppercase tracking-widest mt-0.5 whitespace-nowrap opacity-80">
                    Plan: <span className="text-zinc-400">{Math.round(planned)}g</span>
                </span>
            </div>
        </div>
    );
}
