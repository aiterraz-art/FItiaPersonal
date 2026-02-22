"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Plus, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface FoodItem {
    id: string;
    nombre: string;
    gramos: number;
    kcal: number;
    estado: string;
    consumido: boolean;
}

interface MealCardProps {
    title: string;
    totalKcal: number;
    macros: { p: number; c: number; g: number };
    items: FoodItem[];
    date: string;
    onDelete?: (id: string) => void;
    onEdit?: (logId: string) => void;
    onToggleConsumed?: (id: string, currentStatus: boolean) => void;
    onToggleAllConsumed?: (status: boolean) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRename?: () => void;
    onDeleteMeal?: () => void;
}

export function MealCard({
    title,
    totalKcal,
    macros,
    items,
    date,
    onDelete,
    onEdit,
    onToggleConsumed,
    onToggleAllConsumed,
    onMoveUp,
    onMoveDown,
    onRename,
    onDeleteMeal
}: MealCardProps) {
    const router = useRouter();

    const mealEmoji = title === "Desayuno" ? "🥣" :
        title === "Almuerzo" ? "🍗" :
            title === "Cena" ? "🥗" :
                title.toLowerCase().includes("snack") || title.toLowerCase().includes("merienda") ? "🍎" : "🍽️";

    return (
        <div className="glass-card-subtle p-6 mb-5 group/card transition-all">
            <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                    <div className="text-xl">{mealEmoji}</div>
                    <div>
                        <h3 className="text-lg font-black tracking-tight">{title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Registrado</p>
                            <div className="w-1 h-1 rounded-full bg-fuchsia-500/50" />
                            <p className="text-[10px] bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent font-bold uppercase tracking-widest">{totalKcal} kcal</p>
                        </div>
                    </div>
                </div>
                <div
                    className="flex flex-col items-end gap-2"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1">
                        {onMoveUp && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                                className="p-2.5 rounded-xl bg-zinc-800/40 border border-white/5 text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-95"
                            >
                                <ArrowUp className="w-4 h-4" />
                            </button>
                        )}
                        {onMoveDown && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                                className="p-2.5 rounded-xl bg-zinc-800/40 border border-white/5 text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-95"
                            >
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        )}
                        {onRename && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onRename(); }}
                                className="p-2.5 rounded-xl bg-zinc-800/40 border border-white/5 text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-95"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
                        {onDeleteMeal && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDeleteMeal(); }}
                                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 active:bg-red-500 active:text-white transition-all active:scale-95"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                            {macros.p}P · {macros.c}C · {macros.g}G
                        </p>
                        {items.length > 0 && onToggleAllConsumed && (
                            <button
                                onClick={() => {
                                    const anyUnconsumed = items.some(i => !i.consumido);
                                    onToggleAllConsumed(anyUnconsumed);
                                }}
                                className="mt-2 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all active:scale-95"
                            >
                                {items.every(i => i.consumido) ? "Desmarcar todo" : "Marcar todo"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                <AnimatePresence mode="popLayout">
                    {items.length > 0 ? items.map((item) => (
                        <div key={item.id} className="relative overflow-hidden rounded-2xl">
                            {/* Swipe Background (Delete) */}
                            {onDelete && (
                                <div className="absolute inset-0 bg-linear-to-l from-red-600 to-red-500 flex items-center justify-end px-8">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        whileInView={{ scale: 1, opacity: 1 }}
                                    >
                                        <Trash2 className="w-5 h-5 text-white" />
                                    </motion.div>
                                </div>
                            )}

                            <motion.div
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.6}
                                onDragEnd={(_, info) => {
                                    if (info.offset.x < -100) {
                                        onDelete?.(item.id);
                                    }
                                }}
                                className="relative bg-[#050510] flex justify-between items-center group p-2 pr-0 rounded-2xl border border-transparent active:border-fuchsia-500/20 transition-all cursor-grab active:cursor-grabbing"
                            >
                                <div
                                    className={cn(
                                        "flex gap-3 items-center flex-1 cursor-pointer transition-colors p-2 rounded-xl",
                                        onEdit ? "cursor-pointer" : "cursor-default"
                                    )}
                                    onClick={() => onEdit?.(item.id)}
                                >
                                    <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/15 flex items-center justify-center text-base shrink-0">
                                        🍽️
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold tracking-tight truncate">{item.nombre}</p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{item.estado}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="text-right">
                                        <p className="text-sm font-black">{item.gramos}g</p>
                                        <p className="text-[10px] text-zinc-500 font-bold">{item.kcal} kcal</p>
                                    </div>
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleConsumed?.(item.id, item.consumido);
                                        }}
                                        className={cn(
                                            "w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 mr-2",
                                            item.consumido
                                                ? "bg-fuchsia-500 border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                                                : "bg-fuchsia-500/5 border-fuchsia-500/20 hover:border-fuchsia-500/40"
                                        )}
                                    >
                                        <CheckCircle2 className={cn(
                                            "w-4 h-4 transition-colors",
                                            item.consumido ? "text-white" : "text-fuchsia-500/30 group-hover:text-fuchsia-500/50"
                                        )} />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )) : (
                        <p className="text-xs text-zinc-600 font-medium italic py-2">Sin alimentos registrados</p>
                    )}
                </AnimatePresence>
            </div>

            <button
                onClick={() => router.push(`/add-food?date=${date}&meal=${title}`)}
                className="w-full py-3.5 bg-gradient-to-r from-fuchsia-600/20 to-blue-600/20 border border-fuchsia-500/20 rounded-2xl flex items-center justify-center hover:from-fuchsia-600/30 hover:to-blue-600/30 transition-all duration-300 active:scale-[0.98] group"
            >
                <Plus className="w-5 h-5 text-fuchsia-400 transition-transform group-hover:rotate-90" />
            </button>
        </div>
    );
}
