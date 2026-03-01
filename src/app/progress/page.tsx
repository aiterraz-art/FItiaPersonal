"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, Info, TrendingUp, Target, Scale, Zap, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile, useAnalytics } from "@/hooks/useSupabase";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { BottomNav } from "@/components/navigation/BottomNav";

type TimeFilter = 'Semana' | 'Mes' | 'Año';

export default function Progress() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('Semana');

    const { profile } = useProfile(userId || undefined);
    const { weightData, calorieData, loading } = useAnalytics(userId || undefined);

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            else router.push("/login");
        }
        initAuth();
    }, [router]);

    // Process Chart Data based on Filter
    const processedWeightData = useMemo(() => {
        if (!weightData) return [];
        const now = new Date();
        let daysToKeep = 7;
        if (timeFilter === 'Mes') daysToKeep = 30;
        if (timeFilter === 'Año') daysToKeep = 365;

        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - daysToKeep);

        return weightData
            .filter(d => new Date(d.fecha) >= cutoffDate)
            .map(d => ({
                date: new Date(d.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                weight: Number(d.peso_kg)
            }));
    }, [weightData, timeFilter]);

    const processedCalorieData = useMemo(() => {
        if (!calorieData) return [];
        const now = new Date();
        let daysToKeep = 7;
        if (timeFilter === 'Mes') daysToKeep = 30;
        if (timeFilter === 'Año') daysToKeep = 365;

        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - daysToKeep);

        // Aggregate calories by date
        const dailyAgg: Record<string, number> = {};

        calorieData.forEach((log: any) => {
            if (new Date(log.fecha) < cutoffDate) return;

            let kcal = 0;
            if (log.food_items) {
                kcal = Number(log.food_items.kcal) * (log.gramos / 100);
            } else if (log.recipes) {
                const totalRecipeKcal = (log.recipes.recipe_ingredients || [])
                    .reduce((acc: number, ing: any) => acc + (Number(ing.food_items.kcal) * (ing.gramos / 100)), 0);
                kcal = (totalRecipeKcal / (log.recipes.porciones || 1)) * (log.gramos / 100);
            }

            dailyAgg[log.fecha] = (dailyAgg[log.fecha] || 0) + kcal;
        });

        // Convert to array and format dates
        return Object.entries(dailyAgg)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, val]) => ({
                date: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                value: Math.round(val)
            }));
    }, [calorieData, timeFilter]);

    const imc = profile ? (profile.peso_kg / ((profile.altura_cm / 100) ** 2)).toFixed(1) : "0.0";
    const ffmi = profile ? (profile.peso_kg * (1 - (profile.porcentaje_grasa / 100)) / ((profile.altura_cm / 100) ** 2)).toFixed(1) : "0.0";
    const averageCalories = Math.round(processedCalorieData.reduce((acc, d) => acc + d.value, 0) / (processedCalorieData.length || 1));

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Zap className="w-8 h-8 text-fuchsia-500 animate-pulse" /></div>;

    return (
        <main className="min-h-screen bg-black text-white p-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/")} className="p-2 -ml-2 bg-white/5 rounded-full border border-white/10">
                        <ChevronLeft className="w-5 h-5 text-fuchsia-400" />
                    </button>
                    <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                        ANÁLISIS DE DATOS
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push("/progress/vault")}
                        className="px-4 py-2 bg-gradient-to-r from-fuchsia-600/20 to-blue-600/20 border border-fuchsia-500/30 rounded-full text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-fuchsia-500/10"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" /> Vault Pro
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-blue-500/20 border border-fuchsia-500/30 flex items-center justify-center shadow-lg shadow-fuchsia-500/10">
                        <TrendingUp className="w-5 h-5 text-fuchsia-400" />
                    </div>
                </div>
            </div>

            {/* Time Filter */}
            <div className="flex p-1 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5 mb-8">
                {['Semana', 'Mes', 'Año'].map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setTimeFilter(filter as TimeFilter)}
                        className={cn(
                            "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                            timeFilter === filter
                                ? "bg-gradient-to-r from-fuchsia-600 to-blue-600 text-white shadow-lg shadow-fuchsia-500/20"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="space-y-8">
                {/* Weight Progression */}
                <section className="glass-card p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors" />
                    <div className="flex justify-between items-center mb-6 relative">
                        <div>
                            <h3 className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Progreso de Peso</h3>
                            <p className="text-2xl font-black tracking-tight">{profile?.peso_kg || 0} <span className="text-sm text-zinc-500">kg</span></p>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <Scale className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <ProgressChart data={processedWeightData} type="weight" />
                </section>

                {/* IMC & FFMI Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-6 relative overflow-hidden group border-fuchsia-500/20">
                        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent pointer-events-none" />
                        <div className="flex justify-center items-center gap-1.5 mb-2 text-zinc-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">IMC</span>
                            <Info className="w-3 h-3 opacity-50" />
                        </div>
                        <p className="text-3xl font-black bg-gradient-to-r from-fuchsia-400 to-fuchsia-200 bg-clip-text text-transparent text-center">{imc}</p>
                        <div className="mt-2 text-[9px] text-zinc-600 font-bold uppercase text-center tracking-tighter">Normal Weight</div>
                    </div>
                    <div className="glass-card p-6 relative overflow-hidden group border-blue-500/20">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                        <div className="flex justify-center items-center gap-1.5 mb-2 text-zinc-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">FFMI</span>
                            <Info className="w-3 h-3 opacity-50" />
                        </div>
                        <p className="text-3xl font-black bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent text-center">{ffmi}</p>
                        <div className="mt-2 text-[9px] text-zinc-600 font-bold uppercase text-center tracking-tighter">Óptimo Musculatura</div>
                    </div>
                </div>

                {/* Daily Calories */}
                <section className="glass-card p-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-fuchsia-500/10 blur-[60px] rounded-full -ml-16 -mt-16 group-hover:bg-fuchsia-500/20 transition-colors" />
                    <div className="flex justify-between items-center mb-6 relative">
                        <div>
                            <h3 className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Calorías Diarias</h3>
                            <p className="text-2xl font-black tracking-tight">{averageCalories} <span className="text-sm text-zinc-500">promedio</span></p>
                        </div>
                        <div className="p-3 bg-fuchsia-500/10 rounded-2xl border border-fuchsia-500/20">
                            <TrendingUp className="w-5 h-5 text-fuchsia-400" />
                        </div>
                    </div>
                    <ProgressChart data={processedCalorieData} type="calories" goal={profile?.meta_kcal} />
                </section>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter mb-1">Peso Actual</p>
                        <p className="text-lg font-black text-zinc-200">{profile?.peso_kg || 0}<span className="text-[10px] text-zinc-500 ml-1">kg</span></p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter mb-1">Meta Kcal</p>
                        <p className="text-lg font-black text-blue-400">{profile?.meta_kcal || 0}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter mb-1">Promedio Kcal</p>
                        <p className="text-lg font-black text-fuchsia-400">{averageCalories}</p>
                    </div>
                </div>
            </div>

            <BottomNav />
        </main>
    );
}
