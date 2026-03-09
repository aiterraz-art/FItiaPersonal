"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import { motion, Reorder, useAnimationControls, useDragControls, useReducedMotion } from "framer-motion";
import { CalorieArc, MacroBar } from "@/components/dashboard/ProgressCards";
import { MealCard } from "@/components/dashboard/MealCard";
import { WaterTracker } from "@/components/dashboard/WaterTracker";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AISuggestion } from "@/components/dashboard/AISuggestion";
import { MonthlyCalendar } from "@/components/dashboard/MonthlyCalendar";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn, formatDateAsLocalISO, getTodayLocalDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProfile, useFoodLogs, useWaterLogs, useFoodLogActions, usePreloader } from "@/hooks/useSupabase";
import { toPng } from "html-to-image";
import { Camera } from "lucide-react";
import { ShareSummary } from "@/components/dashboard/ShareSummary";

// Helper outside component
const calculateLogMacros = (log: any) => {
  if (log.food_items) {
    const factor = (log.gramos || 0) / 100;
    return {
      kcal: Number(log.food_items.kcal || 0) * factor,
      p: Number(log.food_items.proteinas || 0) * factor,
      c: Number(log.food_items.carbohidratos || 0) * factor,
      g: Number(log.food_items.grasas || 0) * factor,
      nombre: log.food_items.nombre,
      info: log.food_items.estado || "n/a"
    };
  } else if (log.recipes) {
    const recipe = log.recipes;
    const ingredients = recipe.recipe_ingredients || [];
    const portionsInRecipe = recipe.porciones || 1;
    const factor = (log.gramos || 0) / 100;

    const totalKcal = ingredients.reduce((acc: number, ing: any) => acc + (Number(ing.food_items?.kcal || 0) * (ing.gramos / 100)), 0);
    const totalP = ingredients.reduce((acc: number, ing: any) => acc + (Number(ing.food_items?.proteinas || 0) * (ing.gramos / 100)), 0);
    const totalC = ingredients.reduce((acc: number, ing: any) => acc + (Number(ing.food_items?.carbohidratos || 0) * (ing.gramos / 100)), 0);
    const totalG = ingredients.reduce((acc: number, ing: any) => acc + (Number(ing.food_items?.grasas || 0) * (ing.gramos / 100)), 0);

    const scaleFactor = factor / portionsInRecipe;

    return {
      kcal: totalKcal * scaleFactor,
      p: totalP * scaleFactor,
      c: totalC * scaleFactor,
      g: totalG * scaleFactor,
      nombre: recipe.nombre,
      info: "Receta"
    };
  }
  return { kcal: 0, p: 0, c: 0, g: 0, nombre: "Desconocido", info: "" };
};

const addDaysToDateString = (dateCode: string, diffDays: number) => {
  const d = new Date(dateCode + "T12:00:00");
  d.setDate(d.getDate() + diffDays);
  return formatDateAsLocalISO(d);
};

const buildDateWindow = (centerDate: string, beforeDays = 14, afterDays = 14) => {
  const days: string[] = [];
  for (let i = -beforeDays; i <= afterDays; i++) {
    days.push(addDaysToDateString(centerDate, i));
  }
  return days;
};

const DASHBOARD_SCROLL_KEY = "fitia-dashboard-scroll-v1";

function MealReorderItem({
  meal,
  index,
  orderedMealNames,
  mealItems,
  mealSummary,
  selectedDate,
  handleDeleteLog,
  handleEditLog,
  handleToggleConsumed,
  handleToggleAllConsumed,
  handleMoveMeal,
  handleRenameMeal,
  handleRemoveMeal
}: any) {
  const dragControls = useDragControls();
  const mealMacros = mealSummary || { p: 0, c: 0, g: 0, kcal: 0 };

  return (
    <Reorder.Item
      value={meal}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <MealCard
        title={meal}
        date={selectedDate}
        totalKcal={mealMacros.kcal}
        macros={mealMacros}
        items={mealItems}
        onDelete={handleDeleteLog}
        onEdit={handleEditLog}
        onToggleConsumed={handleToggleConsumed}
        onToggleAllConsumed={(status: boolean) => handleToggleAllConsumed(meal, status)}
        onMoveUp={index > 0 ? () => handleMoveMeal(meal, 'up') : undefined}
        onMoveDown={index < orderedMealNames.length - 1 ? () => handleMoveMeal(meal, 'down') : undefined}
        onRename={() => handleRenameMeal(meal)}
        onDeleteMeal={() => handleRemoveMeal(meal)}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
}


function DayContent({
  userId,
  date,
  profile,
  updateStreak,
  updateMealOrder,
  refetchProfile,
  shareTrigger
}: {
  userId: string | null;
  date: string;
  profile: any;
  updateStreak: () => Promise<void>;
  updateMealOrder: (order: string[]) => Promise<void>;
  refetchProfile: () => Promise<void>;
  shareTrigger: number;
}) {
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCopyCalendarOpen, setIsCopyCalendarOpen] = useState(false);


  const { logs, loading: logsLoading, refetch, setLogs } = useFoodLogs(userId || undefined, date);
  const { toggleConsumed, toggleAllConsumed, renameMealType, deleteMealLogs, deleteAllLogsForDay } = useFoodLogActions();
  const { glasses, loading: waterLoading, addGlass, removeGlass } = useWaterLogs(userId || undefined, date);

  const lastHandledTrigger = useRef(shareTrigger);

  const {
    hiddenMeals,
    mealsWithLogs,
    mealItemsByName,
    mealSummaryByName,
    totalsPlanned,
    totalsConsumed,
    visibleLogs
  } = useMemo(() => {
    const hiddenMealSet = new Set<string>();
    const mealsWithLogsSet = new Set<string>();
    const mealItems: Record<string, any[]> = {};
    const mealSummary: Record<string, { kcal: number; p: number; c: number; g: number }> = {};
    const planned = { kcal: 0, p: 0, c: 0, g: 0 };
    const consumed = { kcal: 0, p: 0, c: 0, g: 0 };
    const nextVisibleLogs: any[] = [];

    logs.forEach((log: any) => {
      if (log.original_unidad === "HIDDEN_MEAL") {
        hiddenMealSet.add(log.comida_tipo);
        return;
      }

      nextVisibleLogs.push(log);
      mealsWithLogsSet.add(log.comida_tipo);
      const macro = calculateLogMacros(log);

      planned.kcal += macro.kcal;
      planned.p += macro.p;
      planned.c += macro.c;
      planned.g += macro.g;

      if (log.consumido) {
        consumed.kcal += macro.kcal;
        consumed.p += macro.p;
        consumed.c += macro.c;
        consumed.g += macro.g;
      }

      if (!mealSummary[log.comida_tipo]) {
        mealSummary[log.comida_tipo] = { kcal: 0, p: 0, c: 0, g: 0 };
      }
      mealSummary[log.comida_tipo].kcal += Math.round(macro.kcal);
      mealSummary[log.comida_tipo].p += Math.round(macro.p);
      mealSummary[log.comida_tipo].c += Math.round(macro.c);
      mealSummary[log.comida_tipo].g += Math.round(macro.g);

      if (!mealItems[log.comida_tipo]) {
        mealItems[log.comida_tipo] = [];
      }
      mealItems[log.comida_tipo].push({
        id: log.id,
        nombre: macro.nombre,
        gramos: log.gramos,
        kcal: Math.round(macro.kcal),
        estado: macro.info,
        consumido: !!log.consumido,
        original_cantidad: log.original_cantidad ?? null,
        original_unidad: log.original_unidad ?? null
      });
    });

    return {
      hiddenMeals: Array.from(hiddenMealSet),
      mealsWithLogs: Array.from(mealsWithLogsSet),
      mealItemsByName: mealItems,
      mealSummaryByName: mealSummary,
      totalsPlanned: planned,
      totalsConsumed: consumed,
      visibleLogs: nextVisibleLogs
    };
  }, [logs]);

  useEffect(() => {
    if (visibleLogs.length > 0 && date === getTodayLocalDate()) {
      updateStreak();
    }
  }, [visibleLogs.length, date, updateStreak]);

  const [orderedMealNames, setOrderedMealNames] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;

    const defaultOrder = ["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"];
    const userOrder = profile.orden_comidas || defaultOrder;
    const hiddenMealsSet = new Set(hiddenMeals);

    const targetMeals = Array.from(new Set([...userOrder, ...mealsWithLogs]))
      .filter((m: string) => !hiddenMealsSet.has(m))
      .sort((a, b) => {
        const indexA = userOrder.indexOf(a);
        const indexB = userOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
      .filter((m: string) => userOrder.includes(m) || mealsWithLogs.includes(m));

    setOrderedMealNames((prev) => {
      if (prev.length === 0) return targetMeals;
      const hasChanges =
        targetMeals.some((m) => !prev.includes(m)) ||
        prev.some((m) => !targetMeals.includes(m));

      if (!hasChanges) return prev;
      return [
        ...prev.filter((m) => targetMeals.includes(m)),
        ...targetMeals.filter((m) => !prev.includes(m))
      ];
    });
  }, [profile, hiddenMeals, mealsWithLogs]);

  const targetKcal = profile?.meta_kcal || 2000;
  const deficit = Math.max(0, targetKcal - totalsConsumed.kcal);

  const rememberDashboardScroll = () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      DASHBOARD_SCROLL_KEY,
      JSON.stringify({ y: window.scrollY, date, ts: Date.now() })
    );
  };

  const keepViewport = (scrollY: number) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "auto" }));
    });
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("¿Seguro que querés eliminar este registro?")) return;
    const originalLogs = [...logs];
    setLogs(logs.filter(l => l.id !== id));

    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      setLogs(originalLogs);
      alert("Error al eliminar el registro.");
    } else {
      refetch();
    }
  };

  const handleEditLog = (id: string) => {
    rememberDashboardScroll();
    router.push(`/add-food?date=${date}&meal=${encodeURIComponent(logs.find(l => l.id === id)?.comida_tipo || '')}&logId=${id}`);
  };

  const handleDeleteAllLogs = async () => {
    if (!userId || logs.length === 0) return;
    if (!confirm("¿Seguro que querés borrar TODOS los alimentos de este día? Esta acción no se puede deshacer.")) return;

    setCopying(true);
    try {
      await deleteAllLogsForDay(userId, date);
      refetch();
    } catch {
      alert("Error al borrar los registros.");
    } finally {
      setCopying(false);
    }
  };


  const handleToggleConsumed = async (id: string, currentStatus: boolean) => {
    setLogs((prev: any[]) => prev.map(l => l.id === id ? { ...l, consumido: !currentStatus } : l));
    try {
      await toggleConsumed(id, currentStatus);
    } catch {
      setLogs((prev: any[]) => prev.map(l => l.id === id ? { ...l, consumido: currentStatus } : l));
      alert("Error al actualizar el estado.");
    }
  };

  const handleToggleAllConsumed = async (mealType: string, status: boolean) => {
    if (!userId) return;
    setLogs((prev: any[]) => prev.map(l => l.comida_tipo === mealType ? { ...l, consumido: status } : l));
    try {
      await toggleAllConsumed(userId, date, mealType, status);
    } catch {
      refetch();
      alert("Error al actualizar la comida completa.");
    }
  };

  const handleCopyFromDate = async (dateToCopy: string) => {
    if (!userId || copying) return;
    setCopying(true);
    try {
      const primaryFetch = await supabase
        .from("food_logs")
        .select("food_id, recipe_id, comida_tipo, gramos, original_cantidad, original_unidad")
        .eq("user_id", userId)
        .eq("fecha", dateToCopy);

      let prevLogs = primaryFetch.data;
      let fetchError = primaryFetch.error;

      // Backward compatibility when original_* columns are not present yet.
      if (fetchError?.message?.includes("original_cantidad")) {
        const fallbackFetch = await supabase
          .from("food_logs")
          .select("food_id, recipe_id, comida_tipo, gramos")
          .eq("user_id", userId)
          .eq("fecha", dateToCopy);

        prevLogs = (fallbackFetch.data || []).map((log) => ({
          ...log,
          original_cantidad: null,
          original_unidad: null,
        }));
        fetchError = fallbackFetch.error;
      }

      if (fetchError) {
        alert("Error al leer la dieta del día seleccionado.");
        return;
      }

      if (!prevLogs || prevLogs.length === 0) {
        alert("No hay registros en la fecha seleccionada para copiar.");
        return;
      }

      const newLogs = prevLogs.map(log => ({
        user_id: userId,
        food_id: log.food_id,
        recipe_id: log.recipe_id,
        comida_tipo: log.comida_tipo,
        gramos: log.gramos,
        original_cantidad: log.original_cantidad ?? null,
        original_unidad: log.original_unidad ?? null,
        consumido: false,
        fecha: date
      }));

      let { error: insertError } = await supabase.from("food_logs").insert(newLogs);

      if (insertError?.message?.includes("original_cantidad")) {
        const fallbackLogs = newLogs.map((log) => ({
          user_id: log.user_id,
          food_id: log.food_id,
          recipe_id: log.recipe_id,
          comida_tipo: log.comida_tipo,
          gramos: log.gramos,
          consumido: log.consumido,
          fecha: log.fecha
        }));
        const { error: fallbackInsertError } = await supabase.from("food_logs").insert(fallbackLogs);
        insertError = fallbackInsertError;
      }

      if (insertError) {
        alert("Error al copiar la dieta.");
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        refetch();
      }
    } catch (err) {
      console.error("Copy error:", err);
    } finally {
      setCopying(false);
    }
  };

  const handleShareDay = useCallback(async () => {
    const el = document.getElementById(`share-summary-card-${date}`);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { quality: 0.95 });
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `elite-nutrition-${date}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '',
            text: ''
          });
          return;
        }
      }
      const link = document.createElement('a');
      link.download = `elite-nutrition-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      alert("No se pudo generar la imagen.");
    }
  }, [date]);

  useEffect(() => {
    if (shareTrigger > lastHandledTrigger.current) {
      lastHandledTrigger.current = shareTrigger;
      handleShareDay();
    }
  }, [shareTrigger, handleShareDay]);

  const handleMoveMeal = async (meal: string, direction: 'up' | 'down') => {
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const list = [...orderedMealNames];
    const index = list.indexOf(meal);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < list.length) {
      [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
      setOrderedMealNames(list);
      await updateMealOrder(list);
      await refetchProfile();
      refetch();
      keepViewport(currentScrollY);
    }
  };

  const handleReorderMeals = async (newOrder: string[]) => {
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    setOrderedMealNames(newOrder);
    await updateMealOrder(newOrder);
    keepViewport(currentScrollY);
  };

  const handleRemoveMeal = async (meal: string) => {
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    if (!profile || !userId) return;
    if (!confirm(`¿Estás seguro de que quieres ocultar "${meal}"?`)) return;
    const originalUIOrder = [...orderedMealNames];
    setOrderedMealNames(prev => prev.filter(m => m !== meal));
    try {
      await deleteMealLogs(userId, date, meal);

      await supabase.from("food_logs").insert({
        user_id: userId,
        comida_tipo: meal,
        fecha: date,
        gramos: 0,
        original_unidad: 'HIDDEN_MEAL'
      });

      refetch();
    } catch {
      setOrderedMealNames(originalUIOrder);
      alert(`No se pudo eliminar la comida.`);
    } finally {
      keepViewport(currentScrollY);
    }
  };

  const handleRenameMeal = async (oldName: string) => {
    const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const newName = prompt(`Renombrar "${oldName}" a:`, oldName);
    if (!newName || !newName.trim() || newName === oldName) return;
    const trimmedNewName = newName.trim();
    const originalUIOrder = [...orderedMealNames];
    setOrderedMealNames(prev => prev.map(m => m === oldName ? trimmedNewName : m));
    try {
      await renameMealType(userId!, date, oldName, trimmedNewName);
      const nextOrder = (profile.orden_comidas || []).map((m: string) => m === oldName ? trimmedNewName : m);
      if (!nextOrder.includes(trimmedNewName)) nextOrder.push(trimmedNewName);
      await updateMealOrder(nextOrder);
      await refetchProfile();
      refetch();
    } catch {
      setOrderedMealNames(originalUIOrder);
      alert(`No se pudo renombrar la comida.`);
    } finally {
      keepViewport(currentScrollY);
    }
  };


  return (
    <div className="w-full max-w-full pb-24 overflow-hidden">
      <section className="px-6 py-4">
        <div className="glass-card overflow-hidden">
          <CalorieArc current={Math.round(totalsConsumed.kcal)} planned={Math.round(totalsPlanned.kcal)} target={targetKcal} />
          <div className="flex px-2 pb-8">
            <MacroBar label="Proteínas" current={totalsConsumed.p} planned={totalsPlanned.p} target={profile?.meta_p || 150} />
            <MacroBar label="Carbs" current={totalsConsumed.c} planned={totalsPlanned.c} target={profile?.meta_c || 200} />
            <MacroBar label="Grasas" current={totalsConsumed.g} planned={totalsPlanned.g} target={profile?.meta_g || 60} />
          </div>
          <div className="px-6 pb-6 pt-2">
            <button className="w-full py-4 text-sm font-bold tracking-tight rounded-2xl border border-fuchsia-500/15 relative overflow-hidden group">
              <div className="absolute inset-0 bg-linear-to-r from-fuchsia-500/15 via-blue-500/10 to-fuchsia-500/15 opacity-60" />
              <span className="relative z-10 bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">Terminar Día</span>
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 py-2">
        {logsLoading ? (
          <div className="space-y-4 mb-6">
            <div className="skeleton h-40 rounded-3xl" />
            <div className="skeleton h-32 rounded-3xl" />
          </div>
        ) : (
          <Reorder.Group axis="y" values={orderedMealNames} onReorder={handleReorderMeals} className="space-y-0">
            {orderedMealNames.map((meal, index) => (
              <MealReorderItem
                key={meal}
                meal={meal}
                index={index}
                orderedMealNames={orderedMealNames}
                mealItems={mealItemsByName[meal] || []}
                mealSummary={mealSummaryByName[meal] || { kcal: 0, p: 0, c: 0, g: 0 }}
                selectedDate={date}
                handleDeleteLog={handleDeleteLog}
                handleEditLog={handleEditLog}
                handleToggleConsumed={handleToggleConsumed}
                handleToggleAllConsumed={handleToggleAllConsumed}
                handleMoveMeal={handleMoveMeal}
                handleRenameMeal={handleRenameMeal}
                handleRemoveMeal={handleRemoveMeal}
              />
            ))}
          </Reorder.Group>
        )}

        <button
          onClick={() => {
            const name = prompt("Nombre de la nueva comida:");
            if (name && name.trim()) {
              rememberDashboardScroll();
              router.push(`/add-food?date=${date}&meal=${encodeURIComponent(name.trim())}`);
            }
          }}
          className="w-full mb-6 py-4 glass-card-subtle flex items-center justify-center gap-3 active:scale-[0.98] transition-all group border-dashed border-fuchsia-500/20"
        >
          <Plus className="w-5 h-5 text-fuchsia-400 group-hover:rotate-90 transition-transform" />
          <span className="text-sm font-bold text-zinc-400 group-hover:text-fuchsia-300 transition-colors">Agregar otra comida</span>
        </button>

        {!logsLoading && visibleLogs.length === 0 && (
          <button onClick={() => setIsCopyCalendarOpen(true)} disabled={copying} className="w-full mb-6 py-5 glass-card flex items-center justify-center gap-3 active:scale-[0.98] transition-all group">
            {copied ? (
              <span className="text-sm font-bold text-fuchsia-400">¡Dieta copiada!</span>
            ) : (
              <span className="text-sm font-bold bg-linear-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Copiar dieta de otro día</span>
            )}
          </button>
        )}

        {!logsLoading && visibleLogs.length > 0 && (
          <button onClick={handleDeleteAllLogs} disabled={copying} className="w-full mb-6 py-4 glass-card-subtle flex items-center justify-center gap-3 active:scale-[0.98] transition-all group border-red-500/20 hover:border-red-500/40">
            <span className="text-sm font-bold text-red-400/80 group-hover:text-red-400 transition-colors">Borrar todo el día</span>
          </button>
        )}

        <div className={cn("transition-opacity duration-200", waterLoading ? "opacity-60" : "opacity-100")}>
          <WaterTracker glasses={glasses} target={3.3} onAddGlass={addGlass} onRemoveGlass={removeGlass} />
        </div>
      </section>

      {userId && (
        <AISuggestion deficit={deficit} macros={{ p: 20, c: 20, g: 5 }} userId={userId} date={date} onPlanApplied={refetch} />
      )}

      <div className="fixed -left-[9999px] top-0 pointer-events-none overflow-hidden h-0">
        <div id={`share-summary-card-${date}`}>
          <ShareSummary
            date={date}
            targetKcal={targetKcal}
            totalsConsumed={totalsConsumed}
            meals={orderedMealNames.map(meal => ({
              type: meal,
              items: mealItemsByName[meal] || []
            })).filter(m => m.items.length > 0)}
          />
        </div>
      </div>

      <MonthlyCalendar
        key={`copy-${isCopyCalendarOpen ? "open" : "closed"}-${date}`}
        isOpen={isCopyCalendarOpen}
        onClose={() => setIsCopyCalendarOpen(false)}
        selectedDate={date}
        onDateSelect={(dateToCopy) => {
          handleCopyFromDate(dateToCopy);
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="app-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <Dashboard />
    </Suspense>
  )
}

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [shareTrigger, setShareTrigger] = useState(0);
  const dayContentControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const previousDateRef = useRef<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isExtendingCarouselRef = useRef(false);
  const carouselPointerStartXRef = useRef<number | null>(null);
  const carouselDragIntentRef = useRef(false);
  const suppressCarouselTapRef = useRef(false);
  const carouselTapTimeoutRef = useRef<number | null>(null);
  const daySwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const dateParam = searchParams.get("date");
  const [selectedDate, setSelectedDate] = useState(dateParam || getTodayLocalDate());
  const [direction, setDirection] = useState(0);
  const [carouselDates, setCarouselDates] = useState<string[]>(() => buildDateWindow(dateParam || getTodayLocalDate()));

  useEffect(() => {
    if (!dateParam) return;
    setSelectedDate(prev => (prev === dateParam ? prev : dateParam));
  }, [dateParam]);

  // Proactive Multi-Day Preloading (±3 days)
  usePreloader(userId, selectedDate);

  const { profile, updateStreak, updateMealOrder, refetchProfile } = useProfile(userId || undefined);

  useEffect(() => {
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      else router.push("/login");
    }
    initAuth();
  }, [router]);

  useEffect(() => {
    if (previousDateRef.current === null) {
      previousDateRef.current = selectedDate;
      dayContentControls.set({ x: 0, opacity: 1 });
      return;
    }

    if (previousDateRef.current === selectedDate) return;

    if (prefersReducedMotion) {
      dayContentControls.set({ x: 0, opacity: 1 });
      previousDateRef.current = selectedDate;
      return;
    }

    const fromX = direction > 0 ? 14 : direction < 0 ? -14 : 0;
    dayContentControls.set({ x: fromX, opacity: 0.98 });
    dayContentControls.start({
      x: 0,
      opacity: 1,
      transition: { duration: 0.14, ease: "easeOut" }
    });
    previousDateRef.current = selectedDate;
  }, [selectedDate, direction, dayContentControls, prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(DASHBOARD_SCROLL_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { y: number; date?: string; ts?: number };
      if (parsed.date && parsed.date !== selectedDate) return;
      const y = Math.max(0, Number(parsed.y || 0));
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
      });
      sessionStorage.removeItem(DASHBOARD_SCROLL_KEY);
    } catch {
      sessionStorage.removeItem(DASHBOARD_SCROLL_KEY);
    }
  }, [selectedDate]);

  useEffect(() => {
    setCarouselDates(prev => (prev.includes(selectedDate) ? prev : buildDateWindow(selectedDate)));
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (carouselTapTimeoutRef.current) {
        window.clearTimeout(carouselTapTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const item = carouselItemRefs.current[selectedDate];
    if (!item) return;
    item.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center"
    });
  }, [selectedDate, carouselDates]);

  const handleInfiniteCarouselScroll = () => {
    const node = carouselRef.current;
    if (!node || isExtendingCarouselRef.current || carouselDates.length === 0) return;

    const edgeThresholdPx = 120;
    const appendBatch = 14;
    const remainingRightPx = node.scrollWidth - (node.scrollLeft + node.clientWidth);

    if (node.scrollLeft < edgeThresholdPx) {
      isExtendingCarouselRef.current = true;
      const oldScrollWidth = node.scrollWidth;

      setCarouselDates(prev => {
        const first = prev[0];
        const prepend = Array.from({ length: appendBatch }, (_, idx) =>
          addDaysToDateString(first, -(appendBatch - idx))
        );
        return [...prepend, ...prev];
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const currentNode = carouselRef.current;
          if (currentNode) {
            const widthDiff = currentNode.scrollWidth - oldScrollWidth;
            currentNode.scrollLeft += widthDiff;
          }
          isExtendingCarouselRef.current = false;
        });
      });
      return;
    }

    if (remainingRightPx < edgeThresholdPx) {
      isExtendingCarouselRef.current = true;
      setCarouselDates(prev => {
        const last = prev[prev.length - 1];
        const append = Array.from({ length: appendBatch }, (_, idx) =>
          addDaysToDateString(last, idx + 1)
        );
        return [...prev, ...append];
      });
      requestAnimationFrame(() => {
        isExtendingCarouselRef.current = false;
      });
    }
  };

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    carouselPointerStartXRef.current = event.clientX;
    carouselDragIntentRef.current = false;
  };

  const handleCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (carouselPointerStartXRef.current === null) return;
    if (Math.abs(event.clientX - carouselPointerStartXRef.current) > 8) {
      carouselDragIntentRef.current = true;
    }
  };

  const handleCarouselPointerEnd = () => {
    if (carouselDragIntentRef.current) {
      suppressCarouselTapRef.current = true;
      if (carouselTapTimeoutRef.current) {
        window.clearTimeout(carouselTapTimeoutRef.current);
      }
      carouselTapTimeoutRef.current = window.setTimeout(() => {
        suppressCarouselTapRef.current = false;
      }, 140);
    }
    carouselPointerStartXRef.current = null;
    carouselDragIntentRef.current = false;
  };

  const handleDateChange = useCallback((newDate: string) => {
    if (newDate === selectedDate) return;
    const oldTime = new Date(selectedDate + "T12:00:00").getTime();
    const newTime = new Date(newDate + "T12:00:00").getTime();
    setDirection(newTime > oldTime ? 1 : -1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const shiftDate = useCallback((delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    handleDateChange(formatDateAsLocalISO(d));
  }, [selectedDate, handleDateChange]);

  const handleDayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    daySwipeStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleDayPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      daySwipeStartRef.current = null;
      return;
    }

    const start = daySwipeStartRef.current;
    daySwipeStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    shiftDate(deltaX > 0 ? -1 : 1);
  };

  return (
    <main className="app-screen pb-32 overflow-x-hidden">
      <header className="px-6 pt-12 pb-10 border-b border-fuchsia-500/10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-fuchsia-500/5 border border-fuchsia-500/10 flex items-center justify-center shadow-inner">
              <span className="text-xs text-fuchsia-400/80 font-black">•••</span>
            </div>
            <button
              onClick={() => setShareTrigger(prev => prev + 1)}
              className="w-11 h-11 rounded-full bg-blue-500/5 border border-blue-500/10 flex items-center justify-center shadow-inner active:scale-95 transition-transform group"
            >
              <Camera className="w-5 h-5 text-blue-400/80 group-hover:text-blue-400" />
            </button>
          </div>
          <button onClick={() => setIsCalendarOpen(true)} className="flex items-center gap-2 font-bold text-lg active:scale-95 transition-transform">
            <span className="bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">📅 {selectedDate === getTodayLocalDate() ? "Hoy" : selectedDate}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-fuchsia-500/10 px-3 py-1.5 rounded-full border border-fuchsia-500/15">
            <span className="text-fuchsia-400 text-sm">🔥 {profile?.racha_actual || 0}</span>
            <div className="w-5 h-5 rounded-full bg-linear-to-r from-fuchsia-500 to-blue-500 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">F</span>
            </div>
          </div>
        </div>

        <div className="px-2 h-20">
          <div
            ref={carouselRef}
            onScroll={handleInfiniteCarouselScroll}
            onPointerDown={handleCarouselPointerDown}
            onPointerMove={handleCarouselPointerMove}
            onPointerUp={handleCarouselPointerEnd}
            onPointerCancel={handleCarouselPointerEnd}
            className="h-full flex items-center gap-2 overflow-x-auto px-1 pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {carouselDates.map((dateCode) => {
              const d = new Date(dateCode + "T12:00:00");
              const isSelected = selectedDate === dateCode;
              return (
                <button
                  key={dateCode}
                  ref={(el) => {
                    carouselItemRefs.current[dateCode] = el;
                  }}
                  onClick={() => {
                    if (suppressCarouselTapRef.current) return;
                    handleDateChange(dateCode);
                  }}
                  className="flex flex-col items-center gap-2 focus:outline-none group shrink-0 w-10 snap-center"
                >
                  <span className={cn("text-[10px] font-bold uppercase", isSelected ? "text-fuchsia-400" : "text-zinc-500")}>
                    {["D", "L", "Ma", "Mi", "J", "V", "S"][d.getDay()]}
                  </span>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all", isSelected ? "bg-linear-to-r from-fuchsia-500 to-blue-500 text-white scale-110 shadow-lg shadow-fuchsia-500/30" : "text-white hover:bg-fuchsia-500/10")}>
                    {d.getDate()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="relative min-h-[60vh]">
        <motion.div
          initial={false}
          animate={dayContentControls}
          onPointerDown={handleDayPointerDown}
          onPointerUp={handleDayPointerEnd}
          onPointerCancel={() => {
            daySwipeStartRef.current = null;
          }}
          className="w-full touch-pan-y"
        >
          <DayContent
            userId={userId}
            date={selectedDate}
            profile={profile}
            updateStreak={updateStreak}
            updateMealOrder={updateMealOrder}
            refetchProfile={refetchProfile}
            shareTrigger={shareTrigger}
          />
        </motion.div>
      </div>

      <MonthlyCalendar
        key={`dashboard-${isCalendarOpen ? "open" : "closed"}-${selectedDate}`}
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onDateSelect={handleDateChange}
      />
      <BottomNav />
    </main>
  );
}
