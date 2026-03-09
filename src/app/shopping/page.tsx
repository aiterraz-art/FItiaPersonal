"use client";

import { Suspense, useState, useEffect } from "react";
import { ChevronLeft, ShoppingBag, CheckCircle2, Share2 } from "lucide-react";
import { cn, formatDateAsLocalISO } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/navigation/BottomNav";
import { getWeekStart } from "@/lib/planning";
import { useShoppingList, useWeeklyPlanActions } from "@/hooks/useSupabase";

export default function ShoppingPage() {
    return (
        <Suspense fallback={<div className="app-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <ShoppingList />
        </Suspense>
    );
}

function ShoppingList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId, setUserId] = useState<string | null>(null);
    const queryWeekStart = searchParams.get("weekStart");
    const resolvedWeekStart = queryWeekStart || getWeekStart(formatDateAsLocalISO(new Date()));
    const { regenerateShoppingList } = useWeeklyPlanActions();
    const { items: aggregatedItems, loading, source, refetch, toggleItem } = useShoppingList(userId || undefined, resolvedWeekStart);

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            } else {
                router.push("/login");
            }
        }
        initAuth();
    }, [router]);

    return (
        <main className="app-screen text-white p-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/")} className="p-2 -ml-2 bg-white/5 rounded-full border border-white/10">
                        <ChevronLeft className="w-5 h-5 text-fuchsia-400" />
                    </button>
                    <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                        SHOPPING LIST
                    </h1>
                </div>
                <button
                    onClick={async () => {
                        if (!userId) return;
                        await regenerateShoppingList(userId, resolvedWeekStart);
                        await refetch();
                    }}
                    className="p-2 bg-white/5 rounded-full border border-white/10"
                >
                    <Share2 className="w-5 h-5 text-zinc-400" />
                </button>
            </div>

            <section className="glass-card p-6 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShoppingBag className="w-20 h-20 text-fuchsia-500 rotate-12" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Resumen Semanal</h3>
                <p className="text-xl font-black tracking-tight mb-4">
                    {aggregatedItems.length} <span className="text-zinc-500 text-sm">ingredientes necesarios</span>
                </p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.18em] mb-4">Fuente: {source}</p>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-fuchsia-600 to-blue-600 transition-all duration-1000"
                        style={{ width: `${(aggregatedItems.filter(item => item.is_checked).length / (aggregatedItems.length || 1)) * 100}%` }}
                    />
                </div>
            </section>

            <div className="space-y-3">
                {loading && (
                    <div className="py-20 text-center">
                        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-xs font-black text-zinc-500 uppercase tracking-widest animate-pulse">Analizando tu plan semanal...</p>
                    </div>
                )}

                {!loading && aggregatedItems.length === 0 && (
                    <div className="py-20 text-center glass-card border-dashed">
                        <p className="text-sm text-zinc-500 italic">No tienes un plan de comidas para esta semana aún.</p>
                        <button onClick={() => router.push("/week")} className="mt-4 text-xs font-black text-fuchsia-400 uppercase tracking-widest border-b border-fuchsia-500/30 pb-1">Ir al plan semanal</button>
                    </div>
                )}

                {aggregatedItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => toggleItem(item.id, !item.is_checked)}
                        className={cn(
                            "w-full glass-card p-5 flex items-center justify-between group transition-all duration-300",
                            item.is_checked ? "opacity-40 grayscale bg-white/[0.02]" : "active:scale-[0.98]"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center transition-all border",
                                item.is_checked
                                    ? "bg-fuchsia-600 border-fuchsia-600 text-white"
                                    : "bg-white/5 border-white/10 text-zinc-700"
                            )}>
                                <CheckCircle2 className={cn("w-4 h-4", item.is_checked ? "block" : "hidden")} />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "font-black tracking-tight transition-all",
                                    item.is_checked ? "line-through text-zinc-500" : "text-white"
                                )}>
                                    {item.ingredient_name}
                                </p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">
                                    {item.quantity_grams >= 1000 ? `${(item.quantity_grams / 1000).toFixed(2)} kg` : `${Math.round(item.quantity_grams)} g`} · {item.source_count} usos
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <BottomNav />
        </main>
    );
}
