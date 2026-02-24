import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { CheckCircle2, Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Si la unidad es "2 galletas" y la cantidad es 3, muestra "6 galletas"
function formatQuantityDisplay(cantidad: number | null | undefined, unidad: string | null | undefined, gramos: number): string {
    if (cantidad == null || !unidad || unidad === 'gramos') return `${gramos}g`;
    const match = unidad.match(/^(\d+\.?\d*)\s+(.+)$/);
    if (match) {
        const unitMultiplier = parseFloat(match[1]);
        const unitName = match[2];
        const total = Math.round(cantidad * unitMultiplier);
        return `${total} ${unitName}`;
    }
    return `${cantidad} ${unidad}`;
}

interface FoodItem {
    id: string;
    nombre: string;
    gramos: number;
    kcal: number;
    estado: string;
    consumido: boolean;
    original_cantidad?: number | null;
    original_unidad?: string | null;
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
    dragControls?: any;
}

function FoodLogItem({
    item,
    onDelete,
    onEdit,
    onToggleConsumed
}: {
    item: FoodItem;
    onDelete?: (id: string) => void;
    onEdit?: (logId: string) => void;
    onToggleConsumed?: (id: string, currentStatus: boolean) => void;
}) {
    const x = useMotionValue(0);
    // The red background opacity is tied to the horizontal offset. 
    // It remains 0 until we pass -10px of drag, then fades in fully at -60px.
    const bgOpacity = useTransform(x, [-60, -10, 0], [1, 0, 0]);
    const iconScale = useTransform(x, [-60, -10], [1, 0.7]);

    return (
        <div className="relative overflow-hidden rounded-2xl">
            {/* Swipe Background (Delete) - Only appears when dragging */}
            {onDelete && (
                <motion.div
                    style={{ opacity: bgOpacity }}
                    className="absolute inset-0 bg-red-600 flex items-center justify-end px-8"
                >
                    <motion.div style={{ scale: iconScale }}>
                        <Trash2 className="w-5 h-5 text-white" />
                    </motion.div>
                </motion.div>
            )}

            <motion.div
                layout
                style={{ x }}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                onDragEnd={(_, info) => {
                    // Logic for deletion threshold
                    if (info.offset.x < -100) {
                        onDelete?.(item.id);
                    }
                }}
                className="relative bg-[#050510] flex justify-between items-center group px-3 py-2 rounded-2xl border border-transparent active:border-fuchsia-500/20 transition-all cursor-grab active:cursor-grabbing"
            >
                <div
                    className={cn(
                        "flex gap-3 items-center flex-1 cursor-pointer transition-colors p-2 rounded-xl",
                        onEdit ? "cursor-pointer" : "cursor-default"
                    )}
                    onClick={() => onEdit?.(item.id)}
                >
                    <div className={cn(
                        "w-9 h-9 rounded-xl border flex items-center justify-center text-base shrink-0 transition-all duration-500",
                        item.consumido
                            ? "bg-zinc-800/50 border-white/5 opacity-40 grayscale"
                            : "bg-fuchsia-500/10 border-fuchsia-500/15"
                    )}>
                        🍽️
                    </div>
                    <div className="flex-1 min-w-0 relative">
                        <p className={cn(
                            "text-sm font-bold tracking-tight wrap-break-word whitespace-normal transition-all duration-500 line-clamp-2",
                            item.consumido ? "text-zinc-500" : "text-white"
                        )}
                            title={item.nombre}
                        >
                            {item.nombre}
                        </p>
                        <AnimatePresence>
                            {item.consumido && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: "100%" }}
                                    exit={{ width: 0 }}
                                    className="absolute top-1/2 left-0 h-[2px] bg-fuchsia-500/40 -translate-y-1/2"
                                />
                            )}
                        </AnimatePresence>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{item.estado}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                    <div className={cn(
                        "text-right transition-all duration-500 min-w-[50px]",
                        item.consumido ? "opacity-40" : "opacity-100"
                    )}>
                        <p className="text-sm font-black">
                            {(() => {
                                const { original_cantidad: cantidad, original_unidad: unidad, gramos } = item;
                                if (cantidad == null || !unidad || unidad === 'gramos') return `${gramos}g`;
                                const match = unidad.match(/^(\d+\.?\d*)\s+(.+)$/);
                                const unitDisplay = match
                                    ? `${Math.round(cantidad * parseFloat(match[1]))} ${match[2]}`
                                    : `${cantidad} ${unidad}`;
                                return (
                                    <span>
                                        {unitDisplay}
                                        <span className="text-zinc-500 font-bold text-[10px] ml-1">· {gramos}g</span>
                                    </span>
                                );
                            })()}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold">{item.kcal} kcal</p>
                    </div>
                    <motion.div
                        whileTap={{ scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleConsumed?.(item.id, item.consumido);
                        }}
                        className={cn(
                            "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500 cursor-pointer",
                            item.consumido
                                ? "bg-fuchsia-500 border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.6)]"
                                : "bg-white/5 border-white/10 hover:border-fuchsia-500/40"
                        )}
                    >
                        <motion.div
                            initial={false}
                            animate={{ scale: item.consumido ? 1 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </motion.div>
                        {!item.consumido && (
                            <div className="w-2 h-2 rounded-full bg-fuchsia-500/20" />
                        )}
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
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
    onDeleteMeal,
    dragControls
}: MealCardProps) {
    const router = useRouter();

    const mealEmoji = title === "Desayuno" ? "🥣" :
        title === "Almuerzo" ? "🍗" :
            title === "Cena" ? "🥗" :
                title.toLowerCase().includes("snack") || title.toLowerCase().includes("merienda") ? "🍎" : "🍽️";

    return (
        <div className="glass-card-subtle px-4 py-5 mb-5 group/card transition-all overflow-hidden">
            <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GripVertical
                            className="w-5 h-5 text-zinc-600 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                            onPointerDown={(e) => dragControls?.start(e)}
                        />
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-fuchsia-500/20 to-blue-500/20 border border-fuchsia-500/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
                            {mealEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3
                                onClick={onRename}
                                className="text-lg font-black tracking-tight text-white flex items-center gap-2 truncate cursor-pointer hover:text-fuchsia-400 active:scale-95 transition-all w-fit"
                            >
                                {title}
                            </h3>
                            <p className="text-[10px] bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent font-bold uppercase tracking-widest">{totalKcal} kcal</p>
                        </div>
                    </div>
                </div>
                <div
                    className="flex flex-col items-end gap-2 shrink-0 ml-2"
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1">
                        {onMoveUp && (
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                                className="p-2.5 rounded-xl bg-zinc-800/40 border border-white/5 text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-95 touch-manipulation"
                            >
                                <ArrowUp className="w-4 h-4" />
                            </button>
                        )}
                        {onMoveDown && (
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                                className="p-2.5 rounded-xl bg-zinc-800/40 border border-white/5 text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-95 touch-manipulation"
                            >
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        )}
                        {onDeleteMeal && (
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onDeleteMeal(); }}
                                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 active:bg-red-500 active:text-white transition-all active:scale-95 touch-manipulation"
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
                <AnimatePresence mode="popLayout" initial={false}>
                    {items.length > 0 ? items.map((item) => (
                        <FoodLogItem
                            key={item.id}
                            item={item}
                            onDelete={onDelete}
                            onEdit={onEdit}
                            onToggleConsumed={onToggleConsumed}
                        />
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
