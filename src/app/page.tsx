"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Plus } from "lucide-react";
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

export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingLogData, setEditingLogData] = useState<{
    id: string;
    nombre: string;
    gramos: number;
    kcal: number;
    baseKcalPer100g: number;
  } | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());

  const { profile, updateStreak } = useProfile(userId || undefined);
  const { logs, refetch } = useFoodLogs(userId || undefined, selectedDate);
  const { toggleConsumed, toggleAllConsumed } = useFoodLogActions();
  const { glasses, addGlass, removeGlass } = useWaterLogs(userId || undefined, selectedDate);

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

  useEffect(() => {
    if (logs.length > 0 && selectedDate === getLocalDateString()) {
      updateStreak();
    }
  }, [logs.length, selectedDate, updateStreak]);

  // Generate current week
  const getWeekDays = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        day: ["L", "M", "M", "J", "V", "S", "D"][i],
        date: d.getDate(),
        full: d.toISOString().split("T")[0]
      };
    });
  };

  const weekDays = getWeekDays();

  // Calculate Totals helper
  const calculateLogMacros = (log: any) => {
    if (log.food_items) {
      const factor = log.gramos / 100;
      return {
        kcal: Number(log.food_items.kcal) * factor,
        p: Number(log.food_items.proteinas) * factor,
        c: Number(log.food_items.carbohidratos) * factor,
        g: Number(log.food_items.grasas) * factor,
        nombre: log.food_items.nombre,
        info: log.food_items.estado || "n/a"
      };
    } else if (log.recipes) {
      const recipe = log.recipes;
      const ingredients = recipe.recipe_ingredients || [];
      const portionsInRecipe = recipe.porciones || 1;
      const loggedPortions = log.gramos / 100;

      const totalRecipe = ingredients.reduce((acc: any, ing: any) => {
        const factor = ing.gramos / 100;
        return {
          kcal: acc.kcal + (ing.food_items.kcal * factor),
          p: acc.p + (ing.food_items.proteinas * factor),
          c: acc.c + (ing.food_items.carbohidratos * factor),
          g: acc.g + (ing.food_items.grasas * factor),
        };
      }, { kcal: 0, p: 0, c: 0, g: 0 });

      return {
        kcal: (totalRecipe.kcal / portionsInRecipe) * loggedPortions,
        p: (totalRecipe.p / portionsInRecipe) * loggedPortions,
        c: (totalRecipe.c / portionsInRecipe) * loggedPortions,
        g: (totalRecipe.g / portionsInRecipe) * loggedPortions,
        nombre: recipe.nombre,
        info: `${loggedPortions} porción${loggedPortions !== 1 ? "es" : ""}`
      };
    }
    return { kcal: 0, p: 0, c: 0, g: 0, nombre: "Desconocido", info: "n/a" };
  };

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
  const totals = totalsPlanned; // Keep 'totals' for other UI components if needed
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

  const getPreviousDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("¿Seguro que querés eliminar este registro?")) return;
    const { error } = await supabase.from("food_logs").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      alert("Error al eliminar el registro.");
    } else {
      refetch();
    }
  };

  const handleEditLog = (id: string) => {
    const log = logs.find(l => l.id === id);
    if (!log) return;

    const m = calculateLogMacros(log);
    // Calculate base kcal per 100g
    let baseKcal = 0;
    if (log.food_items) {
      baseKcal = Number(log.food_items.kcal);
    } else if (log.recipes) {
      // For recipes, we calculate the total kcal and divide by portions and then get the "per portion" kcal
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
    const { error } = await supabase
      .from("food_logs")
      .update({ gramos: newGramos })
      .eq("id", id);

    if (error) {
      console.error("Update error:", error);
      throw error;
    }

    refetch();
  };

  const handleToggleConsumed = async (id: string, currentStatus: boolean) => {
    try {
      await toggleConsumed(id, currentStatus);
      refetch();
    } catch (e) {
      alert("Error al actualizar el estado.");
    }
  };

  const handleToggleAllConsumed = async (mealType: string, status: boolean) => {
    if (!userId) return;
    try {
      await toggleAllConsumed(userId, selectedDate, mealType, status);
      refetch();
    } catch (e) {
      alert("Error al actualizar la comida completa.");
    }
  };

  const handleCopyPreviousDay = async () => {
    if (!userId || copying) return;
    setCopying(true);
    try {
      const prevDate = getPreviousDate(selectedDate);

      // Fetch previous day's logs
      const { data: prevLogs, error: fetchError } = await supabase
        .from("food_logs")
        .select("food_id, comida_tipo, gramos")
        .eq("user_id", userId)
        .eq("fecha", prevDate);

      if (fetchError || !prevLogs || prevLogs.length === 0) {
        alert("No hay registros del d\u00eda anterior para copiar.");
        setCopying(false);
        return;
      }

      // Insert copies for the current date
      const newLogs = prevLogs.map(log => ({
        user_id: userId,
        food_id: log.food_id,
        comida_tipo: log.comida_tipo,
        gramos: log.gramos,
        fecha: selectedDate
      }));

      const { error: insertError } = await supabase
        .from("food_logs")
        .insert(newLogs);

      if (insertError) {
        console.error("Error copying logs:", insertError);
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

  return (
    <main className="min-h-screen pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-10 border-b border-fuchsia-500/10">
        <div className="flex justify-between items-center mb-8">
          <div className="w-11 h-11 rounded-full bg-fuchsia-500/5 border border-fuchsia-500/10 flex items-center justify-center shadow-inner">
            <span className="text-xs text-fuchsia-400/80 font-black">•••</span>
          </div>
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="flex items-center gap-2 font-bold text-lg active:scale-95 transition-transform"
          >
            <span className="bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">📅 {selectedDate === new Date().toISOString().split("T")[0] ? "Hoy" : selectedDate}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-fuchsia-500/10 px-3 py-1.5 rounded-full border border-fuchsia-500/15">
            <span className="text-fuchsia-400 text-sm">🔥 {profile?.racha_actual || 0}</span>
            <div className="w-5 h-5 rounded-full bg-linear-to-r from-fuchsia-500 to-blue-500 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">F</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between px-2">
          {weekDays.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelectedDate(item.full)}
              className="flex flex-col items-center gap-2 focus:outline-none group"
            >
              <span className="text-[10px] text-zinc-500 font-bold group-hover:text-fuchsia-300 transition-colors uppercase">{item.day}</span>
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                selectedDate === item.full ? "bg-linear-to-r from-fuchsia-500 to-blue-500 text-white scale-110 shadow-lg shadow-fuchsia-500/30" : "text-white hover:bg-fuchsia-500/10"
              )}>
                {item.date}
              </div>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                item.full < new Date().toISOString().split("T")[0] ? "bg-fuchsia-400" : item.full === new Date().toISOString().split("T")[0] ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-800"
              )} />
            </button>
          ))}
        </div>
      </header>

      {/* Progress Section */}
      <section className="px-6 py-4">
        <div className="glass-card overflow-hidden">
          <CalorieArc
            current={Math.round(totalsConsumed.kcal)}
            planned={Math.round(totalsPlanned.kcal)}
            target={targetKcal}
          />

          <div className="flex px-2 pb-8">
            <MacroBar label="Proteínas" current={totalsConsumed.p} target={profile?.meta_p || 150} />
            <MacroBar label="Carbs" current={totalsConsumed.c} target={profile?.meta_c || 200} />
            <MacroBar label="Grasas" current={totalsConsumed.g} target={profile?.meta_g || 60} />
          </div>

          <div className="px-6 pb-6 pt-2">
            <button className="w-full py-4 text-sm font-bold tracking-tight rounded-2xl border border-fuchsia-500/15 relative overflow-hidden group">
              <div className="absolute inset-0 bg-linear-to-r from-fuchsia-500/15 via-blue-500/10 to-fuchsia-500/15 opacity-60" />
              <span className="relative z-10 transition-transform group-active:scale-95 bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent">Terminar Día</span>
            </button>
          </div>
        </div>
      </section>

      {/* Meals */}
      <section className="px-6 py-2">
        {(() => {
          const defaultMeals = ["Desayuno", "Almuerzo", "Cena", "Snack 1"];
          const customMealsFromLogs = logs
            .map(l => l.comida_tipo)
            .filter(m => !defaultMeals.includes(m));
          const allMeals = [...defaultMeals, ...Array.from(new Set(customMealsFromLogs))];

          return allMeals.map((meal) => {
            const mealLogsForSummary = logs.filter(l => l.comida_tipo === meal);
            const mealMacros = mealLogsForSummary.reduce((acc, log) => {
              const m = calculateLogMacros(log);
              return {
                p: acc.p + Math.round(m.p),
                c: acc.c + Math.round(m.c),
                g: acc.g + Math.round(m.g),
              };
            }, { p: 0, c: 0, g: 0 });

            return (
              <MealCard
                key={meal}
                title={meal}
                date={selectedDate}
                totalKcal={filterLogsByMeal(meal).reduce((a, b) => a + b.kcal, 0)}
                macros={mealMacros}
                items={filterLogsByMeal(meal)}
                onDelete={handleDeleteLog}
                onEdit={handleEditLog}
                onToggleConsumed={handleToggleConsumed}
                onToggleAllConsumed={(status) => handleToggleAllConsumed(meal, status)}
              />
            );
          });
        })()}

        {/* Add Custom Meal Button */}
        <button
          onClick={() => {
            const name = prompt("Nombre de la nueva comida (ej: Snack 2, Pre-Entreno, Merienda):");
            if (name && name.trim()) {
              router.push(`/add-food?date=${selectedDate}&meal=${encodeURIComponent(name.trim())}`);
            }
          }}
          className="w-full mb-6 py-4 glass-card-subtle flex items-center justify-center gap-3 active:scale-[0.98] transition-all group border-dashed border-fuchsia-500/20"
        >
          <Plus className="w-5 h-5 text-fuchsia-400 transition-transform group-hover:rotate-90" />
          <span className="text-sm font-bold text-zinc-400 group-hover:text-fuchsia-300 transition-colors">
            Agregar otra comida
          </span>
        </button>

        {logs.length === 0 && (
          <button
            onClick={handleCopyPreviousDay}
            disabled={copying}
            className="w-full mb-6 py-5 glass-card flex items-center justify-center gap-3 active:scale-[0.98] transition-all group"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-fuchsia-400" />
                <span className="text-sm font-bold text-fuchsia-400">¡Dieta copiada!</span>
              </>
            ) : copying ? (
              <>
                <div className="w-5 h-5 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-zinc-400">Copiando...</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  Copiar dieta del d\u00eda anterior
                </span>
              </>
            )}
          </button>
        )}

        <WaterTracker glasses={glasses} target={3.3} onAddGlass={addGlass} onRemoveGlass={removeGlass} />
      </section>

      <AISuggestion
        deficit={deficit}
        macros={{ p: 20, c: 20, g: 5 }}
        userId={userId || undefined}
        date={selectedDate}
        onPlanApplied={refetch}
      />

      <EditLogModal
        isOpen={!!editingLogData}
        onClose={() => setEditingLogData(null)}
        log={editingLogData}
        onSave={handleUpdateLog}
      />

      <MonthlyCalendar
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />

      <BottomNav />
    </main>
  );
}
