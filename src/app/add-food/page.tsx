"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { ChevronLeft, Search, Heart, MoreHorizontal, Trash2, ChevronDown, Flag, PlusCircle, BookmarkPlus } from "lucide-react";
import { cn, getTodayLocalDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useFavorites, useTemplates, useWeeklyPlanActions } from "@/hooks/useSupabase";

const QUICK_SWAP_GROUPS = [
    {
        key: "carbohidratos",
        title: "Intercambio de carbohidratos",
        subtitle: "Mantiene aprox. las calorias totales del alimento actual.",
        minMacroPer100: 8,
        allowedStates: ["cocido", "n/a"],
        targets: [
            { key: "arroz-cocido", label: "Arroz cocido", aliases: ["arroz cocido", "arroz blanco", "arroz"] },
            { key: "papa-cocida", label: "Papa cocida", aliases: ["papa cocida", "papas cocidas", "papa", "patata"] },
            { key: "pasta-cocida", label: "Pasta cocida", aliases: ["pasta cocida", "fideos cocidos", "tallarines cocidos"], overrideKcal: 160 },
            { key: "camote-cocido", label: "Zapallo camote cocido", aliases: ["zapallo camote cocido", "zapallo camote", "camote cocido", "camote", "batata cocida", "batata / camote"] },
            { key: "quinoa-cocida", label: "Quinoa cocida", aliases: ["quinoa cocida"] },
            { key: "avena-cocida", label: "Avena cocida", aliases: ["avena cocida"] },
            { key: "cuscus-cocido", label: "Cous cous cocido", aliases: ["cous cous cocido", "cuscus cocido"] }
        ]
    },
    {
        key: "proteinas",
        title: "Intercambio de proteinas",
        subtitle: "Mantiene aprox. las calorias totales del alimento actual.",
        minMacroPer100: 8,
        allowedStates: ["cocido", "n/a"],
        targets: [
            { key: "pollo-cocido", label: "Pollo cocido", aliases: ["pollo cocido", "pechuga de pollo cocida"] },
            { key: "pavo-cocido", label: "Pavo cocido", aliases: ["pavo cocido", "pechuga de pavo cocida"] },
            { key: "atun", label: "Atun al agua", aliases: ["atun al agua", "atún al agua"] },
            { key: "carne-cocida", label: "Carne magra cocida", aliases: ["carne magra cocida", "vacuno cocido", "posta cocida"] },
            { key: "huevo", label: "Huevo", aliases: ["huevo cocido", "huevo"] },
            { key: "tofu", label: "Tofu", aliases: ["tofu"] }
        ]
    },
    {
        key: "grasas",
        title: "Intercambio de grasas",
        subtitle: "Mantiene aprox. las calorias totales del alimento actual.",
        minMacroPer100: 8,
        allowedStates: ["cocido", "n/a", "crudo"],
        targets: [
            { key: "palta", label: "Palta", aliases: ["palta", "aguacate"] },
            { key: "aceite-oliva", label: "Aceite de oliva", aliases: ["aceite de oliva"] },
            { key: "mani", label: "Mani", aliases: ["mani", "maní"] },
            { key: "mantequilla-mani", label: "Mantequilla de mani", aliases: ["mantequilla de mani", "crema de mani"] },
            { key: "nueces", label: "Nueces", aliases: ["nueces", "nuez"] }
        ]
    }
] as const;

function scoreSwapCandidate(item: any, target: { aliases: readonly string[] }) {
    const name = String(item.nombre || "").toLowerCase();
    const state = String(item.estado || "n/a").toLowerCase();
    let score = 0;

    if (state === "cocido") score += 8;
    if (state === "n/a") score += 3;
    if (target.aliases.some((alias) => name === alias)) score += 10;
    if (target.aliases.some((alias) => name.includes(alias))) score += 6;
    if (name.includes("frita") || name.includes("fritas") || name.includes("chips")) score -= 12;
    if (name.includes("great value") || name.includes("lider")) score -= 1;

    return score;
}

export default function AddFood() {
    return (
        <Suspense fallback={
            <div className="app-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AddFoodContent />
        </Suspense>
    );
}

function AddFoodContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState("");
    const [userId, setUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'recientes' | 'favoritos' | 'recetas'>('recientes');
    const [results, setResults] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
    const [selectedFood, setSelectedFood] = useState<any>(null);
    const [convertingState, setConvertingState] = useState(false);
    const [loadingUnit, setLoadingUnit] = useState(false);
    const [gramos, setGramos] = useState(100);
    const [unidad, setUnidad] = useState<'gramos' | 'porcion'>('gramos');
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [quickSwapOptions, setQuickSwapOptions] = useState<Record<string, any[]>>({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newFood, setNewFood] = useState({
        nombre: "",
        kcal: "",
        proteinas: "",
        carbohidratos: "",
        grasas: "",
        categoria: "Otros",
        porcion_nombre: "",
        porcion_gramos: ""
    });
    const [creating, setCreating] = useState(false);

    const targetDate = searchParams.get("date") || getTodayLocalDate();
    const mealType = searchParams.get("meal") || "Almuerzo";
    const editingLogId = searchParams.get("logId") || null;
    const swapMode = searchParams.get("swap") === "1";
    const editMode = Boolean(editingLogId);
    const planMode = searchParams.get("mode") === "plan";
    const { favorites, toggleFavorite } = useFavorites(userId || undefined);
    const { saveMealTemplate } = useTemplates(userId || undefined);
    const { addPlanEntry } = useWeeklyPlanActions();

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        }
        initAuth();
    }, []);

    // Load existing log when in edit mode
    useEffect(() => {
        if (!editingLogId) return;
        async function loadLog() {
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
                .eq('id', editingLogId)
                .single();
            if (error || !data) return;
            if (data.food_items) {
                setSelectedFood({ ...data.food_items, type: 'food' });
            } else if (data.recipes) {
                setSelectedFood(normalizeRecipe({ ...data.recipes, type: 'recipe' }));
            }
            // Restore unit selection
            if (data.original_unidad && data.original_unidad !== 'gramos' && data.original_unidad !== 'HIDDEN_MEAL') {
                setUnidad('porcion');
                setGramos(data.original_cantidad ?? 1);
            } else {
                setUnidad('gramos');
                setGramos(data.gramos ?? 100);
            }
        }
        loadLog();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingLogId]);

    useEffect(() => {
        if (search.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            const searchWords = search.trim().split(/\s+/).filter(w => w.length > 0);

            let foodQuery = supabase.from("food_items").select("*");
            searchWords.forEach(word => {
                foodQuery = foodQuery.ilike("nombre", `%${word}%`);
            });
            const { data: foodItems } = await foodQuery.limit(10);

            let recipeQuery = supabase.from("recipes").select(`
                *,
                recipe_ingredients (
                    *,
                    food_items (*)
                )
            `);
            searchWords.forEach(word => {
                recipeQuery = recipeQuery.ilike("nombre", `%${word}%`);
            });
            const { data: recipes } = await recipeQuery.limit(10);

            const combinedResults = [
                ...(foodItems || []).map(f => ({ ...f, type: 'food' })),
                ...(recipes || []).map(r => ({ ...r, type: 'recipe' }))
            ];

            setResults(combinedResults);
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const recipeId = searchParams.get("recipeId");
        if (recipeId) {
            fetchRecipe(recipeId);
        }
        fetchHistory();
        fetchSavedRecipes();
    }, [searchParams]);

    useEffect(() => {
        async function loadQuickSwapOptions() {
            if (!selectedFood || selectedFood.type === "recipe") {
                setQuickSwapOptions({});
                return;
            }

            const nextOptions: Record<string, any[]> = {};

            for (const group of QUICK_SWAP_GROUPS) {
                const macroValue = Number(selectedFood[group.key] || 0);
                const currentState = String(selectedFood.estado || "n/a").toLowerCase();
                const shouldShowGroup =
                    macroValue >= group.minMacroPer100 &&
                    group.allowedStates.includes(currentState as any);

                if (!shouldShowGroup) {
                    continue;
                }

                const aliasTerms = group.targets.flatMap((target) => target.aliases);
                const query = aliasTerms.map((term) => `nombre.ilike.%${term}%`).join(",");
                const { data, error } = await supabase
                    .from("food_items")
                    .select("*")
                    .or(query);

                if (error || !data) {
                    continue;
                }

                nextOptions[group.key] = group.targets.map((target) => {
                    const match = data
                        .filter((item: any) => target.aliases.some((alias) => item.nombre?.toLowerCase().includes(alias)))
                        .sort((a: any, b: any) => scoreSwapCandidate(b, target) - scoreSwapCandidate(a, target))[0];
                    return match
                        ? {
                            ...match,
                            kcal: (target as any).overrideKcal ?? match.kcal,
                            targetLabel: target.label
                        }
                        : null;
                }).filter(Boolean);
            }

            setQuickSwapOptions(nextOptions);
        }

        loadQuickSwapOptions();
    }, [selectedFood]);

    const fetchSavedRecipes = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('recipes')
            .select(`
                *,
                recipe_ingredients (
                    *,
                    food_items (*)
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            setSavedRecipes(data.map(r => normalizeRecipe(r)));
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('food_logs')
                .select(`
                    *,
                    food_items (*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (data) {
                const uniqueHistory = data.reduce((acc: any[], log: any) => {
                    if (!log.food_items) return acc;
                    const exists = acc.find(f => f.id === log.food_items.id);
                    if (!exists) {
                        acc.push({
                            ...log.food_items,
                            type: 'food',
                            last_cantidad: log.original_cantidad,
                            last_unidad: log.original_unidad
                        });
                    }
                    return acc;
                }, []);
                setHistory(uniqueHistory);
            }
        } catch (err) {
            console.error("History fetch error:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const normalizeRecipe = (recipe: any) => {
        const ingredients = recipe.recipe_ingredients || [];
        const portions = recipe.porciones || 1;

        let totalWeight = 0;
        const sums = ingredients.reduce((acc: any, ing: any) => {
            const f = ing.food_items;
            const factor = ing.gramos / 100;
            totalWeight += Number(ing.gramos || 0);
            return {
                kcal: acc.kcal + (Number(f.kcal) * factor),
                proteinas: acc.proteinas + (Number(f.proteinas) * factor),
                carbohidratos: acc.carbohidratos + (Number(f.carbohidratos) * factor),
                grasas: acc.grasas + (Number(f.grasas) * factor),
            };
        }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });

        // Normalize to 100g base for the UI calculation logic
        const factor100g = totalWeight > 0 ? (100 / totalWeight) : 0;

        return {
            ...recipe,
            type: 'recipe',
            kcal: sums.kcal * factor100g,
            proteinas: sums.proteinas * factor100g,
            carbohidratos: sums.carbohidratos * factor100g,
            grasas: sums.grasas * factor100g,
            porcion_nombre: 'porción',
            porcion_gramos: totalWeight / portions,
            estado: `${portions} porciones`
        };
    };

    const fetchRecipe = async (id: string) => {
        const { data } = await supabase
            .from('recipes')
            .select(`
                *,
                recipe_ingredients (
                    *,
                    food_items (*)
                )
            `)
            .eq('id', id)
            .single();

        if (data) setSelectedFood(normalizeRecipe(data));
    };

    const getCurrentCaloriesTotal = () => {
        if (!selectedFood) return 0;
        const effectiveGrams = getEffectiveGrams(gramos, unidad, selectedFood);
        return (effectiveGrams * Number(selectedFood.kcal || 0)) / 100;
    };

    const handleQuickSwap = (macroKey: "carbohidratos" | "proteinas" | "grasas", targetFood: any) => {
        if (!selectedFood) return;
        const currentCalories = getCurrentCaloriesTotal();
        const targetKcalPer100 = Number(targetFood.kcal || 0);
        if (targetKcalPer100 <= 0) {
            alert("Este alimento no tiene calorias suficientes para calcular el cambio.");
            return;
        }

        const targetGrams = Math.max(1, Math.round((currentCalories * 100) / targetKcalPer100));
        setSelectedFood({ ...targetFood, type: "food" });
        setUnidad("gramos");
        setGramos(targetGrams);
    };

    const calculateTotal = (val: number, base: number) => Math.round((val * base) / 100);

    const favoriteItems = useMemo(() => {
        return favorites.map((entry: any) => {
            if (entry.food_items) {
                return {
                    ...entry.food_items,
                    type: 'food',
                    favorite_id: entry.id
                };
            }
            if (entry.recipes) {
                return {
                    ...normalizeRecipe(entry.recipes),
                    favorite_id: entry.id
                };
            }
            return null;
        }).filter(Boolean);
    }, [favorites]);

    const isFavorite = (food: any) => {
        return favorites.some((entry: any) =>
            (food.type === 'recipe' && entry.recipe_id === food.id) ||
            (food.type !== 'recipe' && entry.food_id === food.id)
        );
    };

    const parsePortionInfo = (portionName?: string | null) => {
        if (!portionName) return { multiplier: 1, label: 'porción' };
        const match = portionName.match(/^(\d+\.?\d*)\s+(.+)$/);
        return match
            ? { multiplier: parseFloat(match[1]), label: match[2] }
            : { multiplier: 1, label: portionName };
    };

    const getEffectiveGrams = (inputCantidad: number, inputUnidad: 'gramos' | 'porcion', food: any) => {
        if (inputUnidad === 'gramos') return inputCantidad;
        const portionInfo = parsePortionInfo(food?.porcion_nombre);
        const portionsCount = inputCantidad / portionInfo.multiplier;
        return portionsCount * Number(food?.porcion_gramos || 100);
    };

    const handleQuickAdd = async (food: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let targetFoodId = food.type === 'recipe' ? null : food.id;
            let targetRecipeId = food.type === 'recipe' ? food.id : null;

            const quantity = food.porcion_gramos ? 1 : (food.last_cantidad || 100);
            const unit = food.porcion_gramos ? (food.porcion_nombre || 'porción') : (food.last_unidad || 'gramos');
            const gramsToAdd = food.porcion_gramos ? Number(food.porcion_gramos) : (food.last_cantidad || 100);

            let error: any = null;
            if (planMode) {
                try {
                    await addPlanEntry(user.id, targetDate, {
                        meal_type: mealType || "Almuerzo",
                        food_id: targetFoodId,
                        recipe_id: targetRecipeId,
                        gramos: gramsToAdd,
                        original_cantidad: quantity,
                        original_unidad: unit
                    });
                } catch (planError) {
                    error = planError;
                }
            } else {
                let insertRes = await supabase.from("food_logs").insert({
                    user_id: user.id,
                    food_id: targetFoodId,
                    recipe_id: targetRecipeId,
                    comida_tipo: (mealType || "Almuerzo") as any,
                    gramos: gramsToAdd,
                    fecha: targetDate,
                    original_cantidad: quantity,
                    original_unidad: unit
                });
                error = insertRes.error;

                if (error && error.message.includes("column") && error.message.includes("original_cantidad")) {
                    console.warn("Retrying insert without original_cantidad columns...");
                    const { error: fallbackError } = await supabase.from("food_logs").insert({
                        user_id: user.id,
                        food_id: targetFoodId,
                        recipe_id: targetRecipeId,
                        comida_tipo: (mealType || "Almuerzo") as any,
                        gramos: gramsToAdd,
                        fecha: targetDate
                    });
                    error = fallbackError;
                }
            }

            if (!error) {
                // Remove hidden meal marker if it exists for this meal
                if (!planMode) {
                    await supabase.from("food_logs").delete().match({
                        user_id: user.id,
                        fecha: targetDate,
                        comida_tipo: mealType || "Almuerzo",
                        original_unidad: 'HIDDEN_MEAL'
                    });
                }

            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteRecipe = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("¿Seguro que querés eliminar esta receta?")) return;
        const { error } = await supabase.from("recipes").delete().eq("id", id);
        if (error) {
            alert("Error al eliminar la receta");
        } else {
            setResults(prev => prev.filter(r => r.id !== id));
            setSavedRecipes(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleAdd = async () => {
        try {
            let { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert("Debes estar conectado para guardar comidas.");
                router.push("/login");
                return;
            }

            // ─── CALCULATE FINAL VALUES ───────────────────────────────────────
            const portionInfo = parsePortionInfo(selectedFood.porcion_nombre);
            const portionsCount = unidad === 'gramos' ? 1 : (gramos / portionInfo.multiplier);
            const newGramos = getEffectiveGrams(gramos, unidad, selectedFood);

            const newOriginalCantidad = portionsCount;
            const newOriginalUnidad = unidad === 'gramos' ? 'gramos' : (selectedFood.porcion_nombre || 'porción');
            const targetFoodId = selectedFood.type === 'recipe' ? null : selectedFood.id;
            const targetRecipeId = selectedFood.type === 'recipe' ? selectedFood.id : null;

            // ─── EDIT MODE: update existing log ───────────────────────────────
            if (editMode && editingLogId) {
                const { error } = await supabase.from('food_logs').update({
                    food_id: targetFoodId,
                    recipe_id: targetRecipeId,
                    gramos: newGramos,
                    original_cantidad: newOriginalCantidad,
                    original_unidad: newOriginalUnidad
                }).eq('id', editingLogId);
                if (error) {
                    alert(`Error al guardar: ${error.message}`);
                    return;
                }
                router.push(planMode ? `/week?date=${targetDate}` : `/?date=${targetDate}`, { scroll: false });
                return;
            }

            // ─── ADD MODE: insert new log ─────────────────────────────────────
            let error: any = null;
            if (planMode) {
                try {
                    await addPlanEntry(user.id, targetDate, {
                        meal_type: mealType || "Almuerzo",
                        food_id: targetFoodId,
                        recipe_id: targetRecipeId,
                        gramos: newGramos,
                        original_cantidad: newOriginalCantidad,
                        original_unidad: newOriginalUnidad
                    });
                } catch (planError) {
                    error = planError;
                }
            } else {
                let insertRes = await supabase.from("food_logs").insert({
                    user_id: user.id,
                    food_id: targetFoodId,
                    recipe_id: targetRecipeId,
                    comida_tipo: (mealType || "Almuerzo") as any,
                    gramos: newGramos,
                    fecha: targetDate,
                    original_cantidad: newOriginalCantidad,
                    original_unidad: newOriginalUnidad
                });
                error = insertRes.error;

                if (error && error.message.includes("column") && error.message.includes("original_cantidad")) {
                    console.warn("Retrying insert without original_cantidad columns...");
                    const { error: fallbackError } = await supabase.from("food_logs").insert({
                        user_id: user.id,
                        food_id: targetFoodId,
                        recipe_id: targetRecipeId,
                        comida_tipo: (mealType || "Almuerzo") as any,
                        gramos: newGramos,
                        fecha: targetDate,
                    });
                    error = fallbackError;
                }
            }

            if (error) {
                console.error("Error inserting food log:", error);
                alert(`Error al guardar: ${error.message}`);
                return;
            }

            // Remove hidden meal marker if it exists for this meal
            if (!planMode) {
                await supabase.from("food_logs").delete().match({
                    user_id: user.id,
                    fecha: targetDate,
                    comida_tipo: mealType || "Almuerzo",
                    original_unidad: 'HIDDEN_MEAL'
                });
            }

            // router.push("/"); // Stay on page to allow adding more
            setSelectedFood(null); // Return to search/list
            setSearch(""); // Clear search for next addition
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateFood = async () => {
        if (!newFood.nombre.trim()) { alert("Ingresá un nombre."); return; }
        if (!newFood.kcal) { alert("Ingresá las calorías."); return; }
        setCreating(true);
        try {
            const { data, error } = await supabase.from("food_items").insert({
                nombre: newFood.nombre.trim(),
                categoria: newFood.categoria || "Otros",
                estado: "n/a",
                kcal: Number(newFood.kcal) || 0,
                proteinas: Number(newFood.proteinas) || 0,
                carbohidratos: Number(newFood.carbohidratos) || 0,
                grasas: Number(newFood.grasas) || 0,
                porcion_nombre: newFood.porcion_nombre.trim() || null,
                porcion_gramos: Number(newFood.porcion_gramos) || null,
            }).select().single();

            if (error) {
                alert("Error al crear: " + error.message);
            } else if (data) {
                setSelectedFood(data);
                setShowCreateForm(false);
                setNewFood({
                    nombre: "",
                    kcal: "",
                    proteinas: "",
                    carbohidratos: "",
                    grasas: "",
                    categoria: "Otros",
                    porcion_nombre: "",
                    porcion_gramos: ""
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteEditedLog = async () => {
        if (!editMode || !editingLogId) {
            setSelectedFood(null);
            return;
        }

        if (!confirm("¿Seguro que querés eliminar este alimento?")) return;

        const { error } = await supabase.from("food_logs").delete().eq("id", editingLogId);
        if (error) {
            alert(`Error al eliminar: ${error.message}`);
            return;
        }

        router.push(planMode ? `/week?date=${targetDate}` : `/?date=${targetDate}`, { scroll: false });
    };

    return (
        <main className="app-screen text-white p-6 font-sans">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => selectedFood ? setSelectedFood(null) : router.push(planMode ? `/week?date=${targetDate}` : `/?date=${targetDate}`, { scroll: false })} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">{selectedFood ? selectedFood.nombre : "Añadir Alimento"}</h1>
                <div className="flex items-center gap-4">
                    {selectedFood && (
                        <>
                            <button
                                onClick={async () => {
                                    await toggleFavorite({
                                        foodId: selectedFood.type === 'recipe' ? null : selectedFood.id,
                                        recipeId: selectedFood.type === 'recipe' ? selectedFood.id : null
                                    });
                                }}
                                className="p-1"
                            >
                                <Heart className={cn("w-6 h-6", isFavorite(selectedFood) ? "text-violet-400 fill-violet-400" : "text-zinc-400")} />
                            </button>
                            <button
                                onClick={async () => {
                                    const templateName = prompt("Nombre de la plantilla de comida:", `${mealType} rápido`);
                                    if (!templateName) return;
                                    await saveMealTemplate(templateName.trim(), mealType, [{
                                        food_id: selectedFood.type === 'recipe' ? null : selectedFood.id,
                                        recipe_id: selectedFood.type === 'recipe' ? selectedFood.id : null,
                                        gramos: getEffectiveGrams(gramos, unidad, selectedFood),
                                        original_cantidad: unidad === 'gramos' ? gramos : gramos,
                                        original_unidad: unidad === 'gramos' ? 'gramos' : (selectedFood.porcion_nombre || 'porción')
                                    }]);
                                    alert("Plantilla guardada.");
                                }}
                                className="p-2 rounded-xl bg-white/5 border border-white/10 active:scale-90 transition-all"
                            >
                                <BookmarkPlus className="w-4 h-4 text-zinc-300" />
                            </button>
                            <MoreHorizontal className="w-6 h-6 text-zinc-400" />
                        </>
                    )}
                    {!selectedFood && <div className="w-6" />}
                </div>
            </div>

            {!selectedFood ? (
                <>
                    <div className="flex gap-3 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar alimento..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-violet-500/5 border border-violet-500/15 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {search.length === 0 && (
                            <div className="flex gap-4 border-b border-zinc-800 mb-4 pb-2">
                                <button
                                    onClick={() => setActiveTab('recientes')}
                                    className={cn(
                                        "text-xs font-bold uppercase tracking-wider pb-2 relative transition-colors",
                                        activeTab === 'recientes' ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Recientes
                                    {activeTab === 'recientes' && (
                                        <motion.div layoutId="activeTabBadge" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('favoritos')}
                                    className={cn(
                                        "text-xs font-bold uppercase tracking-wider pb-2 relative transition-colors",
                                        activeTab === 'favoritos' ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Favoritos
                                    {activeTab === 'favoritos' && (
                                        <motion.div layoutId="activeTabBadge" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('recetas')}
                                    className={cn(
                                        "text-xs font-bold uppercase tracking-wider pb-2 relative transition-colors",
                                        activeTab === 'recetas' ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Mis Recetas
                                    {activeTab === 'recetas' && (
                                        <motion.div layoutId="activeTabBadge" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
                                    )}
                                </button>
                            </div>
                        )}

                        {search.length > 0 && (
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider pl-1">
                                Resultados de búsqueda
                            </p>
                        )}

                        {search.length === 0 && loadingHistory && activeTab === 'recientes' && (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="w-full h-[60px] rounded-xl glass-card-subtle flex items-center gap-3 p-2">
                                        <div className="w-9 h-9 rounded-lg skeleton" />
                                        <div className="flex-1 space-y-2">
                                            <div className="w-24 h-3 skeleton" />
                                            <div className="w-16 h-2 skeleton" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {results.length === 0 && search.length >= 2 && (
                            <div className="py-8 text-center glass-card border-dashed border-zinc-800">
                                <p className="text-sm text-zinc-500 mb-2">No encontramos este alimento en tu base local.</p>
                                <p className="text-xs text-zinc-600">Puedes crearlo manualmente más abajo.</p>
                            </div>
                        )}

                        <motion.div layout className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {(search.length > 0 ? results : (activeTab === 'recientes' ? history : activeTab === 'favoritos' ? favoriteItems : savedRecipes)).map((food) => (
                                    <div key={food.id} className="relative group overflow-hidden rounded-2xl">
                                        <div className="absolute inset-y-0 left-0 w-full bg-zinc-900/50 flex items-center pl-6 z-0">
                                            <PlusCircle className="w-6 h-6 text-fuchsia-500/50" />
                                        </div>

                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 500,
                                                damping: 30,
                                                mass: 1
                                            }}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            dragElastic={0.6}
                                            onDragEnd={(_, info) => {
                                                if (info.offset.x > 100) {
                                                    handleQuickAdd(food);
                                                }
                                            }}
                                            className="relative z-10 will-change-transform cursor-grab active:cursor-grabbing"
                                        >
                                            <button
                                                onClick={() => {
                                                    const newFood = food.type === 'recipe' ? normalizeRecipe(food) : { ...food, type: 'food' };
                                                    setSelectedFood(newFood);

                                                    // Default to portion if it's available (eggs, yogurt, recipes, etc)
                                                    if (newFood.porcion_nombre && newFood.porcion_gramos) {
                                                        setUnidad('porcion');
                                                        setGramos(1);
                                                    } else if (newFood.last_cantidad && newFood.last_unidad) {
                                                        setGramos(newFood.last_cantidad);
                                                        setUnidad(newFood.last_unidad === 'gramos' ? 'gramos' : 'porcion');
                                                    } else {
                                                        const isUnitCommon = /huevo|galleta|pan|rebanada|fruta|frutilla|platano|manzana|yogurt/i.test(newFood.nombre);
                                                        if (isUnitCommon && newFood.porcion_gramos) {
                                                            setUnidad('porcion');
                                                            setGramos(1);
                                                        } else {
                                                            setGramos(100);
                                                            setUnidad('gramos');
                                                        }
                                                    }

                                                    setSearch("");
                                                }}
                                                className={cn(
                                                    "w-full p-2 rounded-xl flex justify-between items-center group active:scale-[0.98] transition-all border border-white/10 backdrop-blur-md",
                                                    "bg-linear-to-r from-fuchsia-500/5 to-violet-500/5",
                                                    search.length === 0 && "border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <motion.div
                                                        layoutId={`food-icon-${food.id}`}
                                                        className="w-9 h-9 shrink-0 rounded-lg bg-linear-to-br from-violet-600 via-violet-500 to-blue-500 flex items-center justify-center text-lg shadow-xl shadow-violet-500/30"
                                                    >
                                                        {food.type === 'recipe' ? '👨‍🍳' : '🍽️'}
                                                    </motion.div>
                                                    <div className="text-left">
                                                        <motion.p layoutId={`food-name-${food.id}`} className="font-bold text-[13px] flex items-center gap-1.5 leading-tight">
                                                            {food.nombre}
                                                            {food.type === 'recipe' && (
                                                                <span className="px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[7px] font-black uppercase tracking-wider border border-violet-500/30">RECETA</span>
                                                            )}
                                                            {activeTab === 'favoritos' && (
                                                                <span className="px-1 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 text-[7px] font-black uppercase tracking-wider border border-fuchsia-500/30">FAVORITO</span>
                                                            )}
                                                            {search.length === 0 && activeTab === 'recientes' && (
                                                                <span className="px-1 py-0.5 rounded bg-zinc-500/20 text-zinc-400 text-[7px] font-black uppercase tracking-wider border border-zinc-500/30">RECIENTE</span>
                                                            )}
                                                        </motion.p>
                                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight mt-0.5">
                                                            {food.type === 'recipe' ? `${food.porciones} porciones` : (food.estado || 'n/a')}
                                                            {food.porcion_nombre && ` • 1 porción = ${food.porcion_gramos}g`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full flex items-center justify-center gap-1 transition-all group-hover:scale-105 active:scale-95 shadow-lg",
                                                    "bg-linear-to-r from-fuchsia-500 to-violet-500 shadow-fuchsia-500/20"
                                                )}>
                                                    <span className="text-[9px] font-black text-white uppercase tracking-widest">ADD</span>
                                                    <PlusCircle className="w-3 h-3 text-white" />
                                                </div>
                                                {food.type === 'recipe' && search.length === 0 && activeTab === 'recetas' && (
                                                    <button
                                                        onClick={(e) => handleDeleteRecipe(food.id, e)}
                                                        className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </button>
                                        </motion.div>
                                    </div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="w-full py-4 bg-linear-to-r from-violet-600/10 to-blue-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all group hover:border-violet-500/40"
                        >
                            <PlusCircle className="w-5 h-5 text-violet-400 transition-transform group-hover:rotate-90" />
                            <span className="text-sm font-bold text-violet-100 group-hover:text-white transition-colors">
                                Crear alimento manualmente
                            </span>
                        </button>

                        {showCreateForm && (
                            <div className="mt-4 glass-card p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h3 className="text-sm font-black uppercase tracking-wider text-violet-300">Nuevo Alimento (por 100g)</h3>
                                <input
                                    type="text"
                                    placeholder="Nombre del alimento"
                                    value={newFood.nombre}
                                    onChange={(e) => setNewFood({ ...newFood, nombre: e.target.value })}
                                    className="w-full bg-violet-500/5 border border-violet-500/15 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 font-medium"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: "kcal", label: "Calorías (kcal)", icon: "🔥" },
                                        { key: "proteinas", label: "Proteínas (g)", icon: "💪" },
                                        { key: "carbohidratos", label: "Carbos (g)", icon: "🌾" },
                                        { key: "grasas", label: "Grasas (g)", icon: "🫒" },
                                    ].map((field) => (
                                        <div key={field.key} className="space-y-1">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                <span>{field.icon}</span> {field.label}
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={(newFood as any)[field.key]}
                                                onChange={(e) => setNewFood({ ...newFood, [field.key]: e.target.value })}
                                                className="w-full bg-violet-500/5 border border-violet-500/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 font-bold text-center"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <select
                                    value={newFood.categoria}
                                    onChange={(e) => setNewFood({ ...newFood, categoria: e.target.value })}
                                    className="w-full bg-violet-500/5 border border-violet-500/15 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 font-medium text-zinc-300"
                                >
                                    {["Proteínas", "Cereales", "Frutas", "Verduras", "Lácteos", "Legumbres", "Grasas", "Snacks", "Comidas", "Bebidas", "Salsas", "Postres", "Suplementos", "Panadería", "Otros"].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>

                                {/* Optional Portion Fields */}
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Porción opcional (ej: 1 unidad = 30g)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Nombre</label>
                                            <input
                                                type="text"
                                                placeholder="ej: unidad"
                                                value={newFood.porcion_nombre}
                                                onChange={(e) => setNewFood({ ...newFood, porcion_nombre: e.target.value })}
                                                className="w-full bg-violet-500/5 border border-violet-500/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 font-medium"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Gramos</label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={newFood.porcion_gramos}
                                                onChange={(e) => setNewFood({ ...newFood, porcion_gramos: e.target.value })}
                                                className="w-full bg-violet-500/5 border border-violet-500/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 font-bold text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateFood}
                                    disabled={creating}
                                    className="w-full py-3.5 bg-linear-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <PlusCircle className="w-4 h-4" />
                                            <span>Crear y seleccionar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-48">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            layoutId={`food-icon-${selectedFood.id}`}
                            className="w-20 h-20 bg-linear-to-br from-violet-600 via-violet-500 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-violet-500/30 relative"
                        >
                            <span className="text-4xl">
                                {selectedFood.type === 'recipe' ? '👨‍🍳' : '🍽️'}
                            </span>
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border border-black shadow-lg">
                                <ChevronDown className="w-3 h-3 text-black" />
                            </div>
                        </motion.div>
                        <motion.h2 layoutId={`food-name-${selectedFood.id}`} className="text-3xl font-extrabold mb-1 tracking-tight">{selectedFood.nombre}</motion.h2>
                        <p className="text-zinc-500 font-bold text-sm">Genérico</p>
                        <p className="text-[10px] text-zinc-500 font-bold mt-6 uppercase tracking-[0.2em]">
                            {(() => {
                                if (unidad === 'gramos') return `Peso: ${gramos}g`;
                                const portionInfo = parsePortionInfo(selectedFood.porcion_nombre);
                                const totalGramos = Math.round(getEffectiveGrams(gramos, 'porcion', selectedFood));
                                const label = portionInfo.label || 'porciones';
                                return `${gramos} ${label} · ${totalGramos}g`;
                            })()} - {selectedFood.estado || 'cocido'}
                        </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'kcal', val: calculateTotal(getEffectiveGrams(gramos, unidad, selectedFood), Number(selectedFood.kcal)) },
                            { label: 'proteínas', val: `${calculateTotal(getEffectiveGrams(gramos, unidad, selectedFood), Number(selectedFood.proteinas || 0))} g` },
                            { label: 'carbs', val: `${calculateTotal(getEffectiveGrams(gramos, unidad, selectedFood), Number(selectedFood.carbohidratos || 0))} g` },
                            { label: 'grasas', val: `${calculateTotal(getEffectiveGrams(gramos, unidad, selectedFood), Number(selectedFood.grasas || 0))} g` },
                        ].map((stat, i) => (
                            <div key={i} className="bg-violet-500/5 border border-violet-500/10 rounded-2xl py-4 px-1 text-center backdrop-blur-sm">
                                <p className="text-lg font-extrabold mb-0.5">{stat.val}</p>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {selectedFood.type !== "recipe" && QUICK_SWAP_GROUPS.map((group) => {
                        const options = (quickSwapOptions[group.key] || []).filter((option) => option.id !== selectedFood.id);
                        if (options.length === 0) return null;

                        return (
                            <div
                                key={group.key}
                                className={cn(
                                    "glass-card p-4 space-y-3",
                                    swapMode && group.key === "carbohidratos" && "border-fuchsia-400/40 shadow-[0_0_0_1px_rgba(244,114,182,0.12)]"
                                )}
                            >
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Conversion rapida</p>
                                    <h3 className="text-sm font-black text-white">{group.title}</h3>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {group.subtitle} Total actual: {Math.round(getCurrentCaloriesTotal())} kcal.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {options.map((option) => {
                                        const targetGrams = Math.max(1, Math.round((getCurrentCaloriesTotal() * 100) / Number(option.kcal || 1)));
                                        return (
                                            <button
                                                key={`${group.key}-${option.id}`}
                                                onClick={() => handleQuickSwap(group.key, option)}
                                                className="rounded-2xl border border-fuchsia-500/15 bg-white/5 p-3 text-left active:scale-[0.98] transition-all"
                                            >
                                                <p className="text-xs font-black text-white leading-tight">{option.targetLabel || option.nombre}</p>
                                                <p className="text-[11px] text-fuchsia-300 font-bold mt-2">{targetGrams}g</p>
                                                <p className="text-[10px] text-zinc-500">
                                                    {Math.round(Number(option.kcal || 0))} kcal / 100g
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    <div className="space-y-4">
                        <div className="h-2 w-full bg-zinc-900/50 rounded-full overflow-hidden flex border border-white/5">
                            <div className="h-full bg-orange-500" style={{ width: '8%' }} />
                            <div className="h-full bg-amber-600" style={{ width: '91%' }} />
                            <div className="h-full bg-yellow-200" style={{ width: '1%' }} />
                        </div>
                        <div className="flex justify-center flex-wrap gap-4 text-[10px] font-extrabold text-zinc-400 italic">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Proteínas 8%</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-600" /> Carbs 91%</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-200" /> Grasas 1%</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {['Información Nutricional', 'Micronutrientes'].map((title) => (
                            <div key={title} className="bg-zinc-900/30 border border-white/5 p-5 flex justify-between items-center rounded-2xl">
                                <span className="font-extrabold text-xs text-zinc-200 uppercase tracking-wider">{title}</span>
                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-zinc-500 pl-1 py-4">
                        <Flag className="w-4 h-4" />
                        <span className="text-xs font-bold">Reportar un problema</span>
                    </div>

                    <div
                        className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 border-t border-violet-500/15 bg-[#0a0614]/90 p-4 backdrop-blur-2xl sm:rounded-t-3xl sm:p-6"
                        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
                    >
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">
                                    {unidad === 'gramos' ? 'Cantidad' : (() => {
                                        const match = selectedFood.porcion_nombre?.match(/^(\d+\.?\d*)\s+(.+)$/);
                                        return match ? match[2] : (selectedFood.porcion_nombre || 'Porciones');
                                    })()}
                                </label>
                                <input
                                    type="number"
                                    value={gramos}
                                    onChange={(e) => setGramos(Number(e.target.value))}
                                    className="w-full bg-violet-500/5 border border-violet-500/15 rounded-2xl py-4 px-2 text-center text-lg font-extrabold focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
                                />
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Unidad</label>
                                <button
                                    disabled={loadingUnit || selectedFood.type === 'recipe'}
                                    onClick={async () => {
                                        if (selectedFood.porcion_nombre) {
                                            if (unidad === 'gramos') {
                                                setUnidad('porcion');
                                                setGramos(1);
                                            } else {
                                                setUnidad('gramos');
                                                setGramos(Math.round(getEffectiveGrams(gramos, 'porcion', selectedFood)));
                                            }
                                        } else if (selectedFood.type !== 'recipe') {
                                            alert("Este alimento no tiene una porción definida. Puedes crearla manualmente desde el alimento.");
                                        }
                                    }}
                                    className={cn(
                                        "w-full border rounded-2xl py-4 px-4 text-center font-bold truncate active:scale-95 transition-all capitalize flex items-center justify-center min-h-[58px]",
                                        selectedFood.porcion_nombre
                                            ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                                            : "bg-zinc-900/50 border-white/10 text-zinc-500 cursor-not-allowed"
                                    )}
                                >
                                    {loadingUnit ? (
                                        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        unidad === 'gramos' ? 'gramos' : (() => {
                                            const match = selectedFood.porcion_nombre?.match(/^(\d+\.?\d*)\s+(.+)$/);
                                            return match ? match[2] : (selectedFood.porcion_nombre || 'unidad');
                                        })()
                                    )}
                                </button>
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Tipo de Peso</label>
                                <button
                                    disabled={convertingState || selectedFood.type === 'recipe'}
                                    onClick={async () => {
                                        setConvertingState(true);
                                        const newEstado = selectedFood.estado === 'cocido' ? 'crudo' : 'cocido';
                                        const baseName = selectedFood.nombre.split('(')[0].split('-')[0].trim();

                                        // 1. Check transient results (from search)
                                        const transientResult = results.find(f =>
                                            f.estado === newEstado &&
                                            f.nombre.toLowerCase().includes(baseName.toLowerCase())
                                        );

                                        if (transientResult) {
                                            setSelectedFood({ ...transientResult, type: 'food' });
                                            setConvertingState(false);
                                            return;
                                        }

                                        // 2. Check Database
                                        const { data } = await supabase
                                            .from("food_items")
                                            .select("*")
                                            .eq("estado", newEstado)
                                            .ilike("nombre", `%${baseName}%`)
                                            .limit(1)
                                            .single();

                                        if (data) {
                                            setSelectedFood(data);
                                            setConvertingState(false);
                                            return;
                                        }

                                        alert("No encontramos una versión local en otro estado para este alimento.");
                                        setConvertingState(false);
                                    }}
                                    className={cn(
                                        "w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 px-2 text-center font-extrabold capitalize text-zinc-200 flex items-center justify-center min-h-[58px]",
                                        (convertingState || selectedFood.type === 'recipe') && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {convertingState ? (
                                        <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (selectedFood.estado || 'n/a')}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteEditedLog}
                                className="w-16 h-16 bg-red-900/20 border border-red-500/20 rounded-full flex items-center justify-center group active:scale-90 transition-transform"
                            >
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </button>
                            <button
                                onClick={handleAdd}
                                className="flex-1 bg-linear-to-r from-fuchsia-500 to-blue-500 h-16 rounded-full text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-fuchsia-500/20 hover:scale-[1.01] active:scale-95 transition-all"
                            >
                                <span>{editMode ? 'Guardar cambios' : planMode ? 'Agregar al plan' : 'Añadir'}</span>
                                <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-1" />
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </main >
    );
}
