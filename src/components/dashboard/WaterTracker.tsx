"use client";

import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface WaterTrackerProps {
    glasses: number;
    target: number;
    onAddGlass: () => void;
    onRemoveGlass: () => void;
}

function GlassIcon({ filled, isNext, onClick, index }: { filled: boolean; isNext: boolean; onClick: () => void; index: number }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative w-10 h-12 transition-all duration-300 active:scale-90 cursor-pointer",
                isNext && !filled && "animate-pulse"
            )}
        >
            <svg viewBox="0 0 40 52" fill="none" className="w-full h-full drop-shadow-md">
                {/* Glass shape - trapezoid */}
                <defs>
                    <clipPath id={`glass-clip-${index}`}>
                        <path d="M6 4 L34 4 L30 48 L10 48 Z" />
                    </clipPath>
                    <linearGradient id={`waterGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d946ef" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.95" />
                    </linearGradient>
                </defs>

                {/* Glass outline */}
                <path
                    d="M6 4 L34 4 L30 48 L10 48 Z"
                    fill={filled ? "none" : "rgba(217,70,239,0.04)"}
                    stroke={filled ? "rgba(217,70,239,0.5)" : isNext ? "rgba(217,70,239,0.3)" : "rgba(217,70,239,0.1)"}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />

                {/* Water fill */}
                {filled && (
                    <>
                        <path
                            d="M7.5 10 L32.5 10 L30 48 L10 48 Z"
                            fill={`url(#waterGrad-${index})`}
                            className="animate-in fade-in duration-500"
                        />
                        {/* Water surface shine */}
                        <ellipse
                            cx="20" cy="12"
                            rx="11" ry="2"
                            fill="rgba(255,255,255,0.15)"
                        />
                        {/* Bubbles */}
                        <circle cx="15" cy="30" r="1" fill="rgba(255,255,255,0.2)" />
                        <circle cx="22" cy="36" r="0.8" fill="rgba(255,255,255,0.15)" />
                        <circle cx="18" cy="40" r="0.6" fill="rgba(255,255,255,0.1)" />
                    </>
                )}

                {/* Glass rim highlight */}
                <path
                    d="M8 4 L32 4"
                    stroke={filled ? "rgba(217,70,239,0.6)" : "rgba(217,70,239,0.15)"}
                    strokeWidth="2"
                    strokeLinecap="round"
                />

                {/* Plus icon for next glass */}
                {isNext && !filled && (
                    <>
                        <line x1="16" y1="26" x2="24" y2="26" stroke="rgba(217,70,239,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="20" y1="22" x2="20" y2="30" stroke="rgba(217,70,239,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                    </>
                )}
            </svg>

            {/* Glow effect for filled glasses */}
            {filled && (
                <div className="absolute inset-0 rounded-xl bg-fuchsia-500/10 blur-md -z-10" />
            )}
        </button>
    );
}

export function WaterTracker({ glasses, target, onAddGlass, onRemoveGlass }: WaterTrackerProps) {
    const totalGlasses = Math.ceil(target / 0.25);
    const displayGlasses = Math.min(totalGlasses, 14);
    const liters = (glasses * 0.25).toFixed(1);
    const percentage = Math.min((glasses / totalGlasses) * 100, 100);

    return (
        <div className="glass-card p-6 mb-4">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-lg font-black tracking-tight">💧 Agua</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                        {glasses} vasos · 250ml c/u
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-black">
                        <span className={cn(
                            "transition-colors",
                            Number(liters) >= target ? "text-fuchsia-400" : ""
                        )}>
                            {liters}
                        </span>
                        <span className="text-zinc-500 text-sm"> / {target} L</span>
                    </p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-fuchsia-500/10 rounded-full overflow-hidden mb-5">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-700",
                        Number(liters) >= target
                            ? "bg-linear-to-r from-fuchsia-500 to-violet-500"
                            : "bg-linear-to-r from-fuchsia-500 to-blue-500"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Glasses grid */}
            <div className="flex flex-wrap gap-1.5 mb-5 justify-center">
                {Array.from({ length: displayGlasses }).map((_, i) => (
                    <GlassIcon
                        key={i}
                        index={i}
                        filled={i < glasses}
                        isNext={i === glasses}
                        onClick={() => {
                            if (i < glasses && i === glasses - 1) onRemoveGlass();
                            else if (i === glasses) onAddGlass();
                        }}
                    />
                ))}
            </div>

            {/* Quick add/remove buttons */}
            <div className="flex gap-3">
                <button
                    onClick={onRemoveGlass}
                    disabled={glasses === 0}
                    className="flex-1 py-3 rounded-2xl border border-fuchsia-500/10 bg-fuchsia-500/5 flex items-center justify-center gap-2 
                               disabled:opacity-30 active:scale-95 transition-all hover:bg-fuchsia-500/10"
                >
                    <Minus className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-xs font-bold text-zinc-400">Quitar</span>
                </button>
                <button
                    onClick={onAddGlass}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600/20 to-blue-600/20 border border-fuchsia-500/20 
                               flex items-center justify-center gap-2 active:scale-95 transition-all hover:from-fuchsia-600/30 hover:to-blue-600/30"
                >
                    <Plus className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-xs font-bold bg-gradient-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">Agregar vaso</span>
                </button>
            </div>
        </div>
    );
}
