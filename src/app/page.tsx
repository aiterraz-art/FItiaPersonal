"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Plus } from "lucide-react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { CalorieArc, MacroBar } from "@/components/dashboard/ProgressCards";
import { MealCard } from "@/components/dashboard/MealCard";
import { WaterTracker } from "@/components/dashboard/WaterTracker";
import { BottomNav } from "@/components/navigation/BottomNav";
import { AISuggestion } from "@/components/dashboard/AISuggestion";
import { EditLogModal } from "@/components/dashboard/EditLogModal";
import { MonthlyCalendar } from "@/components/dashboard/MonthlyCalendar";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProfile, useFoodLogs, useWaterLogs, useFoodLogActions } from "@/hooks/useSupabase";
import { toPng } from "html-to-image";
import { Camera, Share2 } from "lucide-react";
import { ShareSummary } from "@/components/dashboard/ShareSummary";
import { useRef } from "react";

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

function MealReorderItem({
  meal,
  index,
  orderedMealNames,
  logs,
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
  const mealLogsForSummary = logs.filter((l: any) => l.comida_tipo === meal);
  const mealMacros = mealLogsForSummary.reduce((acc: any, log: any) => {
    const m = calculateLogMacros(log);
    return {
      p: acc.p + Math.round(m.p),
      c: acc.c + Math.round(m.c),
      g: acc.g + Math.round(m.g),
    };
  }, { p: 0, c: 0, g: 0 });

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
        totalKcal={mealLogsForSummary.reduce((acc: number, log: any) => acc + Math.round(calculateLogMacros(log).kcal), 0)}
        macros={mealMacros}
        items={mealLogsForSummary.map((l: any) => ({
          id: l.id,
          nombre: l.food_items?.nombre || l.recipes?.nombre || "Alimento",
          gramos: l.gramos,
          kcal: Math.round(calculateLogMacros(l).kcal),
          estado: l.estado || "Crudo",
          consumido: l.consumido
        }))}
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
  shareTrigger,
  onDateChange
}: {
  userId: string | null;
  date: string;
  profile: any;
  updateStreak: () => Promise<void>;
  updateMealOrder: (order: string[]) => Promise<void>;
  refetchProfile: () => Promise<void>;
  shareTrigger: number;
  onDateChange: (d: string) => void;
}) {
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingLogData, setEditingLogData] = useState<{
    id: string;
    nombre: string;
    gramos: number;
    kcal: number;
    baseKcalPer100g: number;
  } | null>(null);

  const { logs, refetch, setLogs } = useFoodLogs(userId || undefined, date);
  const { toggleConsumed, toggleAllConsumed, renameMealType, deleteMealLogs } = useFoodLogActions();
  const { glasses, addGlass, removeGlass } = useWaterLogs(userId || undefined, date);

  useEffect(() => {
    if (logs.length > 0 && date === new Date().toISOString().split("T")[0]) {
      updateStreak();
    }
  }, [logs.length, date, updateStreak]);

  const [orderedMealNames, setOrderedMealNames] = useState<string[]>([]);

  // Stable initialization of orderedMealNames
  useEffect(() => {
    if (!profile || !logs) return;

    const defaultOrder = ["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"];
    const userOrder = profile.orden_comidas || defaultOrder;
    const mealsWithLogs = Array.from(new Set(logs.map(l => l.comida_tipo)));

    const targetMeals = Array.from(new Set([...userOrder, ...mealsWithLogs]))
      .sort((a, b) => {
        const indexA = userOrder.indexOf(a);
        const indexB = userOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
      .filter(m => userOrder.includes(m) || mealsWithLogs.includes(m));

    if (orderedMealNames.length === 0) {
      setOrderedMealNames(targetMeals);
    } else {
      const hasChanges =
        targetMeals.some(m => !orderedMealNames.includes(m)) ||
        orderedMealNames.some(m => !targetMeals.includes(m));

      if (hasChanges) {
        const newOrder = [
          ...orderedMealNames.filter(m => targetMeals.includes(m)),
          ...targetMeals.filter(m => !orderedMealNames.includes(m))
        ];
        setOrderedMealNames(newOrder);
      }
    }
  }, [profile, logs]);

  const totalsPlanned = logs.reduce((acc, log) => {
    const m = calculateLogMacros(log);
    return {
      kcal: acc.kcal + m.kcal,
      p: acc.p + m.p,
      c: acc.c + m.c,
      g: acc.g + m.g,
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const totalsConsumed = logs.reduce((acc, log) => {
    if (!log.consumido) return acc;
    const m = calculateLogMacros(log);
    return {
      kcal: acc.kcal + m.kcal,
      p: acc.p + m.p,
      c: acc.c + m.c,
      g: acc.g + m.g,
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const targetKcal = profile?.meta_kcal || 2000;
  const deficit = Math.max(0, targetKcal - totalsConsumed.kcal);

  const filterLogsByMeal = (type: string) =>
    logs.filter(l => l.comida_tipo === type).map(l => {
      const m = calculateLogMacros(l);
      return {
        id: l.id,
        nombre: m.nombre,
        gramos: l.gramos,
        kcal: Math.round(m.kcal),
        estado: m.info,
        consumido: !!l.consumido
      };
    });

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
    const log = logs.find(l => l.id === id);
    if (!log) return;
    const m = calculateLogMacros(log);
    let baseKcal = 0;
    if (log.food_items) {
      baseKcal = Number(log.food_items.kcal);
    } else if (log.recipes) {
      const totalRecipeKcal = log.recipes.recipe_ingredients.reduce((acc: number, ing: any) => {
        return acc + (ing.food_items.kcal * (ing.gramos / 100));
      }, 0);
      baseKcal = (totalRecipeKcal / log.recipes.porciones);
    }

    setEditingLogData({
      id: log.id,
      nombre: m.nombre,
      gramos: log.gramos,
      kcal: Math.round(m.kcal),
      baseKcalPer100g: baseKcal
    });
  };

  const handleUpdateLog = async (id: string, newGramos: number) => {
    const { error } = await supabase.from("food_logs").update({ gramos: newGramos }).eq("id", id);
    if (error) throw error;
    refetch();
  };

  const handleToggleConsumed = async (id: string, currentStatus: boolean) => {
    setLogs((prev: any[]) => prev.map(l => l.id === id ? { ...l, consumido: !currentStatus } : l));
    try {
      await toggleConsumed(id, currentStatus);
    } catch (e) {
      setLogs((prev: any[]) => prev.map(l => l.id === id ? { ...l, consumido: currentStatus } : l));
      alert("Error al actualizar el estado.");
    }
  };

  const handleToggleAllConsumed = async (mealType: string, status: boolean) => {
    if (!userId) return;
    setLogs((prev: any[]) => prev.map(l => l.comida_tipo === mealType ? { ...l, consumido: status } : l));
    try {
      await toggleAllConsumed(userId, date, mealType, status);
    } catch (e) {
      refetch();
      alert("Error al actualizar la comida completa.");
    }
  };

  const handleCopyPreviousDay = async () => {
    if (!userId || copying) return;
    setCopying(true);
    try {
      const d = new Date(date + "T12:00:00");
      d.setDate(d.getDate() - 1);
      const prevDate = d.toISOString().split("T")[0];

      const { data: prevLogs, error: fetchError } = await supabase
        .from("food_logs")
        .select("food_id, comida_tipo, gramos")
        .eq("user_id", userId)
        .eq("fecha", prevDate);

      if (fetchError || !prevLogs || prevLogs.length === 0) {
        alert("No hay registros del día anterior para copiar.");
        setCopying(false);
        return;
      }

      const newLogs = prevLogs.map(log => ({
        user_id: userId,
        food_id: log.food_id,
        comida_tipo: log.comida_tipo,
        gramos: log.gramos,
        fecha: date
      }));

      const { error: insertError } = await supabase.from("food_logs").insert(newLogs);
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

  const handleShareDay = async () => {
    const el = document.getElementById(`share-summary-card-${date}`);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { quality: 0.95 });
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `fitia-resumen-${date}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Mi nutrición del ${date}`,
            text: 'Resumen generado con Fitia Personal'
          });
          return;
        }
      }
      const link = document.createElement('a');
      link.download = `fitia-resumen-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      alert("No se pudo generar la imagen.");
    }
  };

  useEffect(() => {
    if (shareTrigger > 0) {
      handleShareDay();
    }
  }, [shareTrigger]);

  const handleMoveMeal = async (meal: string, direction: 'up' | 'down') => {
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
    }
  };

  const handleReorderMeals = async (newOrder: string[]) => {
    setOrderedMealNames(newOrder);
    await updateMealOrder(newOrder);
  };

  const handleRemoveMeal = async (meal: string) => {
    if (!profile || !userId) return;
    if (!confirm(`¿Estás seguro de que quieres ocultar "${meal}"?`)) return;
    const originalUIOrder = [...orderedMealNames];
    setOrderedMealNames(prev => prev.filter(m => m !== meal));
    try {
      await deleteMealLogs(userId, date, meal);
      const nextProfileOrder = (profile.orden_comidas || []).filter((m: string) => m !== meal);
      await updateMealOrder(nextProfileOrder);
      await refetchProfile();
      refetch();
    } catch (err) {
      setOrderedMealNames(originalUIOrder);
      alert(`No se pudo eliminar la comida.`);
    }
  };

  const handleRenameMeal = async (oldName: string) => {
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
    } catch (err) {
      setOrderedMealNames(originalUIOrder);
      alert(`No se pudo renombrar la comida.`);
    }
  };


  return (
    <div className="w-full pb-24">
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
        <Reorder.Group axis="y" values={orderedMealNames} onReorder={handleReorderMeals} className="space-y-0">
          {orderedMealNames.map((meal, index) => (
            <MealReorderItem
              key={meal}
              meal={meal}
              index={index}
              orderedMealNames={orderedMealNames}
              logs={logs}
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

        <button
          onClick={() => {
            const name = prompt("Nombre de la nueva comida:");
            if (name && name.trim()) {
              router.push(`/add-food?date=${date}&meal=${encodeURIComponent(name.trim())}`);
            }
          }}
          className="w-full mb-6 py-4 glass-card-subtle flex items-center justify-center gap-3 active:scale-[0.98] transition-all group border-dashed border-fuchsia-500/20"
        >
          <Plus className="w-5 h-5 text-fuchsia-400 group-hover:rotate-90 transition-transform" />
          <span className="text-sm font-bold text-zinc-400 group-hover:text-fuchsia-300 transition-colors">Agregar otra comida</span>
        </button>

        {logs.length === 0 && (
          <button onClick={handleCopyPreviousDay} disabled={copying} className="w-full mb-6 py-5 glass-card flex items-center justify-center gap-3 active:scale-[0.98] transition-all group">
            {copied ? (
              <span className="text-sm font-bold text-fuchsia-400">¡Dieta copiada!</span>
            ) : (
              <span className="text-sm font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Copiar dieta anterior</span>
            )}
          </button>
        )}

        <WaterTracker glasses={glasses} target={3.3} onAddGlass={addGlass} onRemoveGlass={removeGlass} />
      </section>

      {userId && (
        <AISuggestion deficit={deficit} macros={{ p: 20, c: 20, g: 5 }} userId={userId} date={date} onPlanApplied={refetch} />
      )}
      <EditLogModal isOpen={!!editingLogData} onClose={() => setEditingLogData(null)} log={editingLogData} onSave={handleUpdateLog} />

      <div className="fixed -left-[9999px] top-0 pointer-events-none overflow-hidden h-0">
        <div id={`share-summary-card-${date}`}>
          <ShareSummary
            date={date}
            targetKcal={targetKcal}
            totalsConsumed={totalsConsumed}
            meals={Array.from(new Set(logs.map(l => l.comida_tipo))).map(meal => ({
              type: meal,
              items: filterLogsByMeal(meal)
            }))}
          />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [shareTrigger, setShareTrigger] = useState(0);

  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [direction, setDirection] = useState(0);

  const { profile, updateStreak, updateMealOrder, refetchProfile } = useProfile(userId || undefined);

  useEffect(() => {
    async function initAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      else router.push("/login");
    }
    initAuth();
  }, [router]);

  const handleDateChange = (newDate: string) => {
    const oldTime = new Date(selectedDate + "T12:00:00").getTime();
    const newTime = new Date(newDate + "T12:00:00").getTime();
    setDirection(newTime > oldTime ? 1 : -1);
    setSelectedDate(newDate);
  };

  const getCarouselDays = () => {
    const baseDate = new Date(selectedDate + "T12:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - 3 + i);
      return {
        day: ["D", "L", "M", "M", "J", "V", "S"][d.getDay()],
        date: d.getDate(),
        full: d.toISOString().split("T")[0]
      };
    });
  };

  return (
    <main className="min-h-screen pb-32 overflow-x-hidden">
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
            <span className="bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">📅 {selectedDate === getLocalDateString() ? "Hoy" : selectedDate}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-fuchsia-500/10 px-3 py-1.5 rounded-full border border-fuchsia-500/15">
            <span className="text-fuchsia-400 text-sm">🔥 {profile?.racha_actual || 0}</span>
            <div className="w-5 h-5 rounded-full bg-linear-to-r from-fuchsia-500 to-blue-500 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">F</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden px-2 h-20">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={selectedDate}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? "100%" : d < 0 ? "-100%" : 0, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d < 0 ? "100%" : d > 0 ? "-100%" : 0, opacity: 0 })
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={(_, info) => {
                if (info.offset.x > 50) {
                  const d = new Date(selectedDate + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  handleDateChange(d.toISOString().split("T")[0]);
                } else if (info.offset.x < -50) {
                  const d = new Date(selectedDate + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  handleDateChange(d.toISOString().split("T")[0]);
                }
              }}
              className="absolute inset-x-2 flex justify-between items-center cursor-grab active:cursor-grabbing pb-4"
            >
              {getCarouselDays().map((item) => {
                const isSelected = selectedDate === item.full;
                return (
                  <button key={item.full} onClick={() => handleDateChange(item.full)} className="flex flex-col items-center gap-2 focus:outline-none group shrink-0 w-[14.28%]">
                    <span className={cn("text-[10px] font-bold uppercase", isSelected ? "text-fuchsia-400" : "text-zinc-500")}>{item.day}</span>
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all", isSelected ? "bg-linear-to-r from-fuchsia-500 to-blue-500 text-white scale-110 shadow-lg shadow-fuchsia-500/30" : "text-white hover:bg-fuchsia-500/10")}>{item.date}</div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </header>

      <div className="relative min-h-[60vh]">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={selectedDate}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? "100%" : d < 0 ? "-100%" : 0, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d < 0 ? "100%" : d > 0 ? "-100%" : 0, opacity: 0 })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 250, damping: 32, mass: 0.8 }, opacity: { duration: 0.2 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            dragDirectionLock
            onDragEnd={(_, info) => {
              const threshold = 50;
              if (info.offset.x > threshold) {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() - 1);
                handleDateChange(d.toISOString().split("T")[0]);
              } else if (info.offset.x < -threshold) {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() + 1);
                handleDateChange(d.toISOString().split("T")[0]);
              }
            }}
            className="w-full"
          >
            <DayContent
              userId={userId}
              date={selectedDate}
              profile={profile}
              updateStreak={updateStreak}
              updateMealOrder={updateMealOrder}
              refetchProfile={refetchProfile}
              shareTrigger={shareTrigger}
              onDateChange={handleDateChange}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <MonthlyCalendar isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      <BottomNav />
    </main>
  );
}
