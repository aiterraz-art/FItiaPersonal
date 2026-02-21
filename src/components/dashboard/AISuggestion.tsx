"use client";

import { useState } from "react";
import { Sparkles, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface AISuggestionProps {
    deficit: number;
    macros: { p: number; c: number; g: number };
    userId?: string;
    date: string;
    onPlanApplied?: () => void;
}

export function AISuggestion({ deficit, macros, userId, date, onPlanApplied }: AISuggestionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<"suggest" | "plan">("plan");
    const [suggestion, setSuggestion] = useState<any>(null);
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [command, setCommand] = useState("");
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function getSuggestion() {
        setLoading(true);
        setIsOpen(true);
        setMode("suggest");
        try {
            const res = await fetch("/api/ai-suggest", {
                method: "POST",
                body: JSON.stringify({ deficit, macrosRestantes: macros }),
            });
            const data = await res.json();
            setSuggestion(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function generatePlan() {
        if (!command.trim()) return;
        setLoading(true);
        setPlan(null);
        setError(null);
        try {
            const res = await fetch("/api/ai-diet-gen", {
                method: "POST",
                body: JSON.stringify({ prompt: command, userId, date }),
            });
            const data = await res.json();
            if (res.status !== 200) {
                setError(data.details || data.error || "Error al generar el plan");
            } else {
                setPlan(data);
            }
        } catch (e) {
            console.error(e);
            setError("Error de conexión con la IA");
        } finally {
            setLoading(false);
        }
    }

    async function applyPlan() {
        if (!plan || !userId || applying) return;
        setApplying(true);
        try {
            const logsToInsert = plan.meals.map((m: any) => ({
                user_id: userId,
                food_id: m.food_id,
                comida_tipo: m.comida_tipo,
                gramos: m.gramos_cocido, // As specified by user
                fecha: date
            }));

            const { error } = await supabase.from('food_logs').insert(logsToInsert);
            if (error) throw error;

            setIsOpen(false);
            setPlan(null);
            setCommand("");
            if (onPlanApplied) onPlanApplied();
        } catch (e) {
            console.error(e);
            alert("Error al aplicar el plan");
        } finally {
            setApplying(false);
        }
    }

    return (
        <>
            <button
                onClick={getSuggestion}
                className="fixed bottom-32 right-6 w-14 h-14 bg-gradient-to-br from-fuchsia-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-fuchsia-500/40 z-40 hover:scale-110 active:scale-95 transition-all text-white"
            >
                <Sparkles className="w-6 h-6 fill-white" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-24">
                    <div className="w-full bg-[#050510] rounded-3xl p-8 animate-in slide-in-from-bottom-full duration-500 max-w-lg relative border border-fuchsia-500/20 shadow-2xl shadow-fuchsia-500/20 mx-4">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-violet-400 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                                    <Sparkles className="w-5 h-5 text-white fill-white" />
                                </div>
                                <h2 className="text-xl font-bold bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent italic">Coach IA</h2>
                            </div>
                            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setMode("plan")}
                                    className={cn("px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", mode === "plan" ? "bg-fuchsia-500/20 text-fuchsia-400" : "text-zinc-500")}
                                >
                                    Plan
                                </button>
                                <button
                                    onClick={() => { setMode("suggest"); if (!suggestion) getSuggestion(); }}
                                    className={cn("px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", mode === "suggest" ? "bg-fuchsia-500/20 text-fuchsia-400" : "text-zinc-500")}
                                >
                                    Idea
                                </button>
                            </div>
                        </div>

                        {mode === "plan" ? (
                            <div className="space-y-6">
                                {!plan && !loading ? (
                                    <div className="space-y-4">
                                        <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                                            Dime qué quieres comer hoy o mañana, cuántas comidas y tus objetivos. Armaré el plan perfecto para ti.
                                        </p>
                                        <div className="relative">
                                            <textarea
                                                value={command}
                                                onChange={(e) => setCommand(e.target.value)}
                                                placeholder="Ej: Mañana 3800 kcal, 7 comidas de pollo y arroz, 250g proteína..."
                                                className="w-full bg-zinc-900/50 border border-fuchsia-500/10 rounded-2xl p-4 text-zinc-200 text-sm focus:outline-none focus:border-fuchsia-500/30 transition-colors min-h-[120px] resize-none"
                                            />
                                            <button
                                                onClick={generatePlan}
                                                disabled={!command.trim() || loading}
                                                className="absolute bottom-4 right-4 w-10 h-10 bg-fuchsia-500 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                                            >
                                                <Send className="w-5 h-5" />
                                            </button>
                                        </div>
                                        {error && (
                                            <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-2 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                                                ⚠ {error}
                                            </p>
                                        )}
                                    </div>
                                ) : loading ? (
                                    <div className="py-12 flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4" />
                                        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Calculando tu Plan Maestro...</p>
                                    </div>
                                ) : plan?.summary ? (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black text-fuchsia-400/50 uppercase tracking-widest mb-1">Total Plan</p>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-black text-zinc-100">{plan.summary.total_kcal}</span>
                                                    <span className="text-sm font-bold text-zinc-500">kcal</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">P</p>
                                                    <p className="text-sm font-bold text-zinc-300">{plan.summary.total_p}g</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">C</p>
                                                    <p className="text-sm font-bold text-zinc-300">{plan.summary.total_c}g</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">G</p>
                                                    <p className="text-sm font-bold text-zinc-300">{plan.summary.total_g}g</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                            {plan.meals?.map((meal: any, idx: number) => (
                                                <div key={idx} className="glass-card-subtle p-4 border-fuchsia-500/5 flex justify-between items-center group">
                                                    <div>
                                                        <p className="text-[8px] font-black text-fuchsia-400 uppercase tracking-widest mb-1">{meal.comida_tipo}</p>
                                                        <h4 className="text-sm font-bold text-zinc-200">{meal.nombre}</h4>
                                                        <p className="text-xs text-zinc-500 font-medium">{meal.gramos_cocido}g en cocido</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-zinc-300">{meal.kcal} kcal</p>
                                                        <p className="text-[10px] text-zinc-600 font-bold">{meal.p}P · {meal.c}C · {meal.g}G</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPlan(null)}
                                                className="flex-1 py-4 bg-zinc-900 text-zinc-400 font-black uppercase tracking-widest text-[10px] rounded-2xl border border-white/5"
                                            >
                                                Reintentar
                                            </button>
                                            <button
                                                onClick={applyPlan}
                                                disabled={applying}
                                                className="flex-[2] py-4 bg-linear-to-r from-fuchsia-600 to-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Confirmar y Aplicar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4 text-center">
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Esperando comando...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Existing Suggestion Mode
                            loading ? (
                                <div className="py-12 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Analizando tus macros...</p>
                                </div>
                            ) : suggestion && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <p className="text-lg font-medium text-zinc-300 leading-tight">
                                        {suggestion.mensaje}
                                    </p>

                                    <div className="glass-card p-6 border-fuchsia-500/20">
                                        <h3 className="text-2xl font-bold mb-3 tracking-tight">{suggestion.nombre}</h3>
                                        <div className="flex gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Energía</span>
                                                <span className="font-black text-xl text-fuchsia-400">{suggestion.kcal}<span className="text-xs ml-0.5">kcal</span></span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Proteínas</span>
                                                <span className="font-bold text-xl">{suggestion.p}g</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Carbs</span>
                                                <span className="font-bold text-xl">{suggestion.c}g</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="w-full py-4 bg-linear-to-r from-fuchsia-600 to-blue-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-all"
                                    >
                                        Confirmar y Añadir
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
