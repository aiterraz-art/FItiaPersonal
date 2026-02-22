"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";

interface ShareSummaryProps {
    date: string;
    targetKcal: number;
    totalsConsumed: { kcal: number; p: number; c: number; g: number };
    meals: Array<{
        type: string;
        items: Array<{ nombre: string; kcal: number; gramos: number; estado: string; consumido: boolean }>;
    }>;
}

export function ShareSummary({ date, targetKcal, totalsConsumed, meals }: ShareSummaryProps) {
    const formattedDate = new Date(date + "T12:00:00").toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    return (
        <div
            id="share-summary-card"
            className="w-[400px] bg-zinc-950 p-8 flex flex-col gap-8 relative overflow-hidden"
            style={{
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
        >
            {/* Background Decorations */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-600/20 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full" />

            {/* Header */}
            <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-fuchsia-500 to-blue-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-black bg-linear-to-r from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter">
                            Elite Nutrition
                        </span>
                    </div>
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Personal Assistant</span>
                </div>
                <div className="text-right">
                    <span className="text-fuchsia-400 font-black text-xs uppercase tracking-widest block">{formattedDate}</span>
                </div>
            </div>

            {/* Main Stats */}
            <div className="glass-card p-6 relative z-10 border-white/10 bg-white/2">
                <div className="flex items-center justify-around">
                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-black text-white tracking-tighter">
                            {Math.round(totalsConsumed.kcal)}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Calorías</span>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-black text-zinc-500 tracking-tighter opacity-50">
                            {Math.round(targetKcal)}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Meta</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
                    <div className="flex flex-col items-center">
                        <span className="text-fuchsia-400 font-black text-lg tracking-tighter">{Math.round(totalsConsumed.p)}g</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Proteínas</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-blue-400 font-black text-lg tracking-tighter">{Math.round(totalsConsumed.c)}g</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Carbs</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-fuchsia-300 font-black text-lg tracking-tighter">{Math.round(totalsConsumed.g)}g</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Grasas</span>
                    </div>
                </div>
            </div>

            {/* Meal Breakdown */}
            <div className="flex flex-col gap-4 relative z-10">
                <h3 className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] pl-1">Desglose de Comidas</h3>
                <div className="flex flex-col gap-3">
                    {meals.filter(m => m.items.length > 0).map((meal, idx) => (
                        <div key={idx} className="bg-white/3 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-zinc-300 font-black text-xs uppercase tracking-wider">{meal.type}</span>
                                <span className="text-fuchsia-400/80 font-black text-[10px]">{meal.items.reduce((acc, i) => acc + i.kcal, 0)} kcal</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {meal.items.map((item, iIdx) => (
                                    <div key={iIdx} className="flex justify-between items-center group">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "text-[11px] font-bold line-clamp-1",
                                                    item.consumido ? "text-fuchsia-400" : "text-zinc-400"
                                                )}>
                                                    {item.nombre}
                                                </span>
                                                {item.consumido && (
                                                    <div className="w-3 h-3 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                                                        <Check className="w-2 h-2 text-fuchsia-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-zinc-600 text-[9px] font-medium">{item.gramos}g • {item.estado}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold",
                                            item.consumido ? "text-fuchsia-400/80" : "text-zinc-500"
                                        )}>{item.kcal}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-6 border-t border-white/5 text-center relative z-10">
                <p className="text-zinc-600 text-[9px] font-medium italic">
                    "Tu progreso es el resultado de tus hábitos diarios."
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="h-px w-8 bg-linear-to-r from-transparent to-zinc-800" />
                    <span className="text-[8px] text-zinc-800 font-black tracking-[0.5em] uppercase">Elite Nutrition</span>
                    <div className="h-px w-8 bg-linear-to-l from-transparent to-zinc-800" />
                </div>
            </div>
        </div>
    );
}
