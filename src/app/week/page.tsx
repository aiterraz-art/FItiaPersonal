"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, Copy, Plus, RefreshCcw, ShoppingBasket, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/navigation/BottomNav";
import { supabase } from "@/lib/supabase";
import { cn, formatDateAsLocalISO, getTodayLocalDate } from "@/lib/utils";
import { getWeekStart } from "@/lib/planning";
import { useTemplates, useWeeklyPlan, useWeeklyPlanActions } from "@/hooks/useSupabase";

const DEFAULT_MEALS = ["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"];

export default function WeekPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(getTodayLocalDate());
    const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const { dayTemplates } = useTemplates(userId || undefined);
    const { entriesByDate, loading, refetch } = useWeeklyPlan(userId || undefined, weekStart);
    const { duplicateDayPlan, clearDayPlan, repeatWeek, regenerateShoppingList, applyDayTemplate } = useWeeklyPlanActions();

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            else router.push("/login");
        }
        initAuth();
    }, [router]);

    const days = useMemo(() => {
        const base = new Date(`${weekStart}T12:00:00`);
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(base);
            date.setDate(base.getDate() + index);
            return formatDateAsLocalISO(date);
        });
    }, [weekStart]);

    const handleApplyTemplate = async (date: string) => {
        if (!userId || dayTemplates.length === 0) return;
        const input = prompt(`Plantilla a aplicar:\n${dayTemplates.map((template, index) => `${index + 1}. ${template.name}`).join("\n")}`);
        const index = Number(input) - 1;
        if (Number.isNaN(index) || index < 0 || index >= dayTemplates.length) return;
        setBusyKey(`template-${date}`);
        try {
            await applyDayTemplate(userId, dayTemplates[index].id, date);
            await refetch();
        } finally {
            setBusyKey(null);
        }
    };

    const handleCopyToNextWeek = async () => {
        if (!userId) return;
        const nextWeek = new Date(`${weekStart}T12:00:00`);
        nextWeek.setDate(nextWeek.getDate() + 7);
        setBusyKey("repeat-week");
        try {
            await repeatWeek(userId, weekStart, formatDateAsLocalISO(nextWeek));
            alert("Semana repetida en la siguiente semana.");
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <main className="app-screen text-white px-4 pt-6 pb-32">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push("/")} className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <ChevronLeft className="w-5 h-5 text-fuchsia-400" />
                    </button>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Planificación</p>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <CalendarRange className="w-6 h-6 text-fuchsia-400" />
                            Semana
                        </h1>
                    </div>
                </div>
                <button
                    onClick={() => router.push(`/shopping?weekStart=${weekStart}`)}
                    className="p-3 rounded-2xl bg-linear-to-r from-fuchsia-600/20 to-blue-600/20 border border-fuchsia-500/30"
                >
                    <ShoppingBasket className="w-5 h-5 text-fuchsia-300" />
                </button>
            </div>

            <div className="glass-card p-4 mb-5">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleCopyToNextWeek}
                        disabled={busyKey === "repeat-week"}
                        className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Copy className="w-4 h-4 text-fuchsia-400" />
                            Repetir semana
                        </span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!userId) return;
                            setBusyKey("shopping");
                            try {
                                await regenerateShoppingList(userId, weekStart);
                                router.push(`/shopping?weekStart=${weekStart}`);
                            } finally {
                                setBusyKey(null);
                            }
                        }}
                        disabled={busyKey === "shopping"}
                        className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
                    >
                        <span className="inline-flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4 text-blue-400" />
                            Generar compras
                        </span>
                    </button>
                    <button
                        onClick={() => router.push("/templates")}
                        className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-400" />
                            Plantillas
                        </span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
                <div className="grid grid-cols-7 gap-3 min-w-[980px]">
                    {days.map((date) => {
                        const entries = entriesByDate[date] || [];
                        const meals = DEFAULT_MEALS.map((meal) => ({
                            meal,
                            items: entries.filter((entry) => entry.meal_type === meal)
                        })).filter((group) => group.items.length > 0 || mealShouldRender(group.meal));
                        const isToday = date === getTodayLocalDate();
                        const busy = busyKey === date || busyKey?.endsWith(date);

                        return (
                            <div
                                key={date}
                                className={cn(
                                    "glass-card-subtle p-4 border min-h-[520px]",
                                    isToday ? "border-fuchsia-500/30" : "border-white/5"
                                )}
                            >
                                <button
                                    onClick={() => setSelectedDate(date)}
                                    className={cn(
                                        "w-full rounded-2xl px-3 py-3 mb-4 border text-left transition-all",
                                        selectedDate === date ? "bg-fuchsia-500/10 border-fuchsia-500/30" : "bg-white/5 border-white/5"
                                    )}
                                >
                                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.18em]">
                                        {new Date(`${date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short" })}
                                    </p>
                                    <p className="text-lg font-black">{date.slice(8)}</p>
                                    <p className="text-[10px] text-zinc-500">{date}</p>
                                </button>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    <button
                                        onClick={() => handleApplyTemplate(date)}
                                        disabled={dayTemplates.length === 0}
                                        className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider"
                                    >
                                        Plantilla
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!userId) return;
                                            const tomorrow = new Date(`${date}T12:00:00`);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            setBusyKey(date);
                                            try {
                                                await duplicateDayPlan(userId, date, formatDateAsLocalISO(tomorrow));
                                                await refetch();
                                            } finally {
                                                setBusyKey(null);
                                            }
                                        }}
                                        className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider"
                                    >
                                        Copiar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!userId) return;
                                            if (!confirm("¿Limpiar este día del plan semanal?")) return;
                                            setBusyKey(date);
                                            try {
                                                await clearDayPlan(userId, date);
                                                await refetch();
                                            } finally {
                                                setBusyKey(null);
                                            }
                                        }}
                                        className="px-2.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black uppercase tracking-wider text-red-300"
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Limpiar
                                        </span>
                                    </button>
                                </div>

                                <div className={cn("space-y-3 transition-opacity", busy || loading ? "opacity-60" : "opacity-100")}>
                                    {meals.map(({ meal, items }) => (
                                        <div key={meal} className="rounded-2xl border border-white/5 bg-black/10 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{meal}</p>
                                                <button
                                                    onClick={() => router.push(`/add-food?date=${date}&meal=${encodeURIComponent(meal)}&mode=plan`)}
                                                    className="p-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20"
                                                >
                                                    <Plus className="w-3.5 h-3.5 text-fuchsia-300" />
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {items.length === 0 && (
                                                    <p className="text-[11px] text-zinc-600 italic">Sin items</p>
                                                )}
                                                {items.map((item) => (
                                                    <div key={item.id} className="rounded-xl bg-white/5 px-3 py-2">
                                                        <p className="text-xs font-bold text-white line-clamp-2">
                                                            {item.food_items?.nombre || item.recipes?.nombre || "Item"}
                                                        </p>
                                                        <p className="text-[10px] text-zinc-500 font-bold">
                                                            {item.original_cantidad && item.original_unidad && item.original_unidad !== "gramos"
                                                                ? `${item.original_cantidad} ${item.original_unidad}`
                                                                : `${Math.round(item.gramos)}g`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <BottomNav />
        </main>
    );
}

function mealShouldRender(meal: string) {
    return DEFAULT_MEALS.includes(meal);
}
