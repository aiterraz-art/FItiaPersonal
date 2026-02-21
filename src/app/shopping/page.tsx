"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ShoppingBag, CheckCircle2, Circle, Trash2, Printer, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function ShoppingList() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                fetchWeeklyLogs(user.id);
            } else {
                router.push("/login");
            }
        }
        initAuth();
    }, [router]);

    const fetchWeeklyLogs = async (uid: string) => {
        setLoading(true);
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)).toISOString().split('T')[0];
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 7)).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('food_logs')
            .select(`
                *,
                food_items (*),
                recipes (
                    *,
                    recipe_ingredients (
                        *,
                        food_items (*)
                    )
                )
            `)
            .eq('user_id', uid)
            .gte('fecha', startOfWeek)
            .lte('fecha', endOfWeek);

        if (data) setWeeklyLogs(data);
        setLoading(false);
    };

    const aggregatedItems = useMemo(() => {
        const items: Record<string, { nombre: string, gramos: number, unit: string }> = {};

        weeklyLogs.forEach(entry => {
            if (entry.food_items) {
                const name = entry.food_items.nombre;
                if (!items[name]) items[name] = { nombre: name, gramos: 0, unit: "g" };
                items[name].gramos += entry.gramos;
            } else if (entry.recipes) {
                (entry.recipes.recipe_ingredients || []).forEach((ing: any) => {
                    if (ing.food_items) {
                        const name = ing.food_items.nombre;
                        if (!items[name]) items[name] = { nombre: name, gramos: 0, unit: "g" };
                        // Recipe ingredient grams are per portion * entry grams / 100? 
                        // Actually, recipe_ingredients.gramos is for the whole recipe.
                        // We need (ing.gramos / recipe.porciones) * (entry.gramos / 100?) 
                        // Wait, food_logs for recipes has 'gramos' as number of portions or total grams?
                        // Assuming food_logs.gramos is total grams of the recipe consumed.
                        const portionFactor = entry.gramos / (entry.recipes.porciones || 1);
                        // If gramos in food_log is portions, then portionFactor = entry.gramos.
                        // Based on page.tsx, if it's a recipe, we use grams.
                        items[name].gramos += (ing.gramos / (entry.recipes.porciones || 1)) * (entry.gramos / 100);
                    }
                });
            }
        });

        return Object.values(items).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [weeklyLogs]);

    const toggleItem = (name: string) => {
        setCheckedItems(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <main className="min-h-screen bg-black text-white p-6 pb-32">
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
                <button className="p-2 bg-white/5 rounded-full border border-white/10">
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
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-fuchsia-600 to-blue-600 transition-all duration-1000"
                        style={{ width: `${(Object.values(checkedItems).filter(Boolean).length / (aggregatedItems.length || 1)) * 100}%` }}
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
                        <button onClick={() => router.push("/")} className="mt-4 text-xs font-black text-fuchsia-400 uppercase tracking-widest border-b border-fuchsia-500/30 pb-1">Ir al Planificador</button>
                    </div>
                )}

                {aggregatedItems.map((item) => (
                    <button
                        key={item.nombre}
                        onClick={() => toggleItem(item.nombre)}
                        className={cn(
                            "w-full glass-card p-5 flex items-center justify-between group transition-all duration-300",
                            checkedItems[item.nombre] ? "opacity-40 grayscale bg-white/[0.02]" : "active:scale-[0.98]"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center transition-all border",
                                checkedItems[item.nombre]
                                    ? "bg-fuchsia-600 border-fuchsia-600 text-white"
                                    : "bg-white/5 border-white/10 text-zinc-700"
                            )}>
                                <CheckCircle2 className={cn("w-4 h-4", checkedItems[item.nombre] ? "block" : "hidden")} />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "font-black tracking-tight transition-all",
                                    checkedItems[item.nombre] ? "line-through text-zinc-500" : "text-white"
                                )}>
                                    {item.nombre}
                                </p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">
                                    {item.gramos >= 1000 ? `${(item.gramos / 1000).toFixed(2)} kg` : `${Math.round(item.gramos)} g`}
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
