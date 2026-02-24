"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { ChevronLeft, Search, Info, Heart, Share2, MoreHorizontal, Trash2, ChevronDown, Flag, PlusCircle, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export default function AddFood() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
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
    const [activeTab, setActiveTab] = useState<'recientes' | 'recetas'>('recientes');
    const [results, setResults] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
    const [selectedFood, setSelectedFood] = useState<any>(null);
    const [convertingState, setConvertingState] = useState(false);
    const [loadingUnit, setLoadingUnit] = useState(false);
    const [gramos, setGramos] = useState(100);
    const [unidad, setUnidad] = useState<'gramos' | 'porcion'>('gramos');
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newFood, setNewFood] = useState({ nombre: "", kcal: "", proteinas: "", carbohidratos: "", grasas: "", categoria: "Otros" });
    const [creating, setCreating] = useState(false);
    const [scanning, setScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const targetDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const mealType = searchParams.get("meal") || "Almuerzo";
    const editingLogId = searchParams.get("logId") || null;
    const [editMode, setEditMode] = useState(!!editingLogId);

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
            const { data: foodItems } = await supabase
                .from("food_items")
                .select("*")
                .ilike("nombre", `%${search}%`)
                .limit(10);

            const { data: recipes } = await supabase
                .from("recipes")
                .select(`
                    *,
                    recipe_ingredients (
                        *,
                        food_items (*)
                    )
                `)
                .ilike("nombre", `%${search}%`)
                .limit(5);

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

    const calculateTotal = (val: number, base: number) => Math.round((val * base) / 100);

    const handleAISearch = async () => {
        if (!search) return;
        setAiLoading(true);
        try {
            const res = await fetch("/api/ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: search })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.items && Array.isArray(data.items)) {
                const aiResults = data.items.map((item: any, idx: number) => ({
                    ...item,
                    id: `ai-${Date.now()}-${idx}`,
                    type: 'food',
                    isAI: true
                }));
                setResults(prev => [...aiResults, ...prev]);
            }
        } catch (err) {
            console.error("AI Search Error:", err);
            alert("No se pudo obtener información de la IA. Verifica tu conexión o API Key.");
        } finally {
            setAiLoading(false);
        }
    };

    const handleQuickAdd = async (food: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let targetFoodId = food.type === 'recipe' ? null : food.id;
            let targetRecipeId = food.type === 'recipe' ? food.id : null;

            // If it's an AI result, we need to persist it to the global database first
            if (food.isAI) {
                const foodData = {
                    nombre: String(food.nombre || "Alimento IA"),
                    categoria: String(food.categoria || "Otros"),
                    estado: (['crudo', 'cocido', 'n/a'].includes(food.estado) ? food.estado : 'n/a') as any,
                    kcal: Number(food.kcal) || 0,
                    proteinas: Number(food.proteinas) || 0,
                    carbohidratos: Number(food.carbohidratos) || 0,
                    grasas: Number(food.grasas) || 0,
                    porcion_nombre: food.porcion_nombre || null,
                    porcion_gramos: food.porcion_gramos || null
                };

                const { data: persistedFood, error: foodError } = await supabase
                    .from("food_items")
                    .insert(foodData)
                    .select()
                    .single();

                if (foodError) {
                    console.error("Error creating AI food in quick add:", foodError);
                    alert(`Error al guardar el nuevo alimento de IA: ${foodError.message}`);
                    return;
                }
                targetFoodId = persistedFood.id;

                // Update local history/results with the new ID to prevent multiple inserts if clicked again
                setResults(prev => prev.map(f => f.id === food.id ? { ...persistedFood, type: 'food', isAI: false } : f));
            }

            const gramsToAdd = food.porcion_gramos ? Number(food.porcion_gramos) : 100;

            let { error } = await supabase.from("food_logs").insert({
                user_id: user.id,
                food_id: targetFoodId,
                recipe_id: targetRecipeId,
                comida_tipo: (mealType || "Almuerzo") as any,
                gramos: gramsToAdd,
                fecha: targetDate,
                original_cantidad: food.porcion_gramos ? 1 : 100,
                original_unidad: food.porcion_gramos ? (food.porcion_nombre || 'porción') : 'gramos'
            });

            // FALLBACK: If column original_cantidad doesn't exist yet
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

            if (!error) {
                // Remove hidden meal marker if it exists for this meal
                await supabase.from("food_logs").delete().match({
                    user_id: user.id,
                    fecha: targetDate,
                    comida_tipo: mealType || "Almuerzo",
                    original_unidad: 'HIDDEN_MEAL'
                });

                // Stay on page as requested before
                if (food.isAI) fetchHistory(); // Refresh history if it was a new item
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

            const newGramos = unidad === 'gramos' ? gramos : (gramos * (selectedFood.porcion_gramos || 100));
            const newOriginalCantidad = gramos;
            const newOriginalUnidad = unidad === 'gramos' ? 'gramos' : (selectedFood.porcion_nombre || 'porcion');

            // ─── EDIT MODE: update existing log ───────────────────────────────
            if (editMode && editingLogId) {
                const { error } = await supabase.from('food_logs').update({
                    gramos: newGramos,
                    original_cantidad: newOriginalCantidad,
                    original_unidad: newOriginalUnidad
                }).eq('id', editingLogId);
                if (error) {
                    alert(`Error al guardar: ${error.message}`);
                    return;
                }
                router.push(`/?date=${targetDate}`);
                return;
            }

            // ─── ADD MODE: insert new log ─────────────────────────────────────
            let targetFoodId = selectedFood.type === 'recipe' ? null : selectedFood.id;
            let targetRecipeId = selectedFood.type === 'recipe' ? selectedFood.id : null;

            if (selectedFood.isAI) {
                const foodData = {
                    nombre: String(selectedFood.nombre || "Alimento IA"),
                    categoria: String(selectedFood.categoria || "Otros"),
                    estado: (['crudo', 'cocido', 'n/a'].includes(selectedFood.estado) ? selectedFood.estado : 'n/a') as any,
                    kcal: Number(selectedFood.kcal) || 0,
                    proteinas: Number(selectedFood.proteinas) || 0,
                    carbohidratos: Number(selectedFood.carbohidratos) || 0,
                    grasas: Number(selectedFood.grasas) || 0,
                    porcion_nombre: selectedFood.porcion_nombre || null,
                    porcion_gramos: selectedFood.porcion_gramos || null
                };

                const { data: persistedFood, error: foodError } = await supabase
                    .from("food_items")
                    .insert(foodData)
                    .select()
                    .single();

                if (foodError) {
                    console.error("Error creating AI food:", foodError);
                    alert(`Error al guardar el nuevo alimento de IA: ${foodError.message}`);
                    return;
                }
                targetFoodId = persistedFood.id;

                // Update local state to show it's now a "regular" food item
                setResults(prev => prev.map(f => f.id === selectedFood.id ? { ...persistedFood, type: 'food', isAI: false } : f));
            }

            let { error } = await supabase.from("food_logs").insert({
                user_id: user.id,
                food_id: targetFoodId,
                recipe_id: targetRecipeId,
                comida_tipo: (mealType || "Almuerzo") as any,
                gramos: newGramos,
                fecha: targetDate,
                original_cantidad: newOriginalCantidad,
                original_unidad: newOriginalUnidad
            });

            // FALLBACK: If columns are missing
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

            if (error) {
                console.error("Error inserting food log:", error);
                alert(`Error al guardar: ${error.message}`);
                return;
            }

            // Remove hidden meal marker if it exists for this meal
            await supabase.from("food_logs").delete().match({
                user_id: user.id,
                fecha: targetDate,
                comida_tipo: mealType || "Almuerzo",
                original_unidad: 'HIDDEN_MEAL'
            });

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
            }).select().single();

            if (error) {
                alert("Error al crear: " + error.message);
            } else if (data) {
                setSelectedFood(data);
                setShowCreateForm(false);
                setNewFood({ nombre: "", kcal: "", proteinas: "", carbohidratos: "", grasas: "", categoria: "Otros" });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handlePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setScanning(true);
        try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            const base64Image = await base64Promise;

            const res = await fetch("/api/ai/vision-scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.items && data.items.length > 0) {
                const bestMatch = data.items[0];
                const scannedFood = {
                    nombre: bestMatch.nombre || "Alimento escaneado",
                    kcal: bestMatch.kcal || 0,
                    proteinas: bestMatch.p || 0,
                    carbohidratos: bestMatch.c || 0,
                    grasas: bestMatch.g || 0,
                    categoria: "Otros",
                    estado: "n/a", // Usually package/labels don't have cooked/raw state, just n/a
                    porcion_nombre: bestMatch.porcion_nombre || "porción",
                    porcion_gramos: bestMatch.porcion_gramos || null,
                    isAI: true,
                };
                setSelectedFood(scannedFood);

                if (bestMatch.porcion_gramos) {
                    setUnidad('porcion');
                    setGramos(1);
                } else {
                    setUnidad('gramos');
                    setGramos(bestMatch.gramos || 100);
                }
            } else {
                alert("No se detectaron alimentos en la foto. Intentá de nuevo.");
            }
        } catch (err: any) {
            console.error("Scan error:", err);
            alert("No se pudo analizar la imagen. Intentá con otra foto más clara.");
        } finally {
            setScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <main className="min-h-screen text-white p-6 font-sans">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => selectedFood ? setSelectedFood(null) : router.push(`/?date=${targetDate}`)} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">{selectedFood ? selectedFood.nombre : "Añadir Alimento"}</h1>
                <div className="flex items-center gap-4">
                    {selectedFood && (
                        <>
                            <Heart className="w-6 h-6 text-violet-400 fill-violet-400" />
                            <Share2 className="w-6 h-6 text-zinc-400" />
                            <MoreHorizontal className="w-6 h-6 text-zinc-400" />
                        </>
                    )}
                    {!selectedFood && <div className="w-6" />}
                </div>
            </div>

            {!selectedFood ? (
                <>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoScan}
                        className="hidden"
                    />

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
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={scanning}
                            className="w-14 h-14 rounded-2xl bg-linear-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 active:scale-90 transition-all disabled:opacity-50 shrink-0"
                        >
                            {scanning ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Camera className="w-6 h-6 text-white" />
                            )}
                        </button>
                    </div>

                    {scanning && (
                        <div className="py-10 text-center glass-card mb-6">
                            <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm font-bold text-violet-300 animate-pulse">Analizando etiqueta nutricional...</p>
                            <p className="text-xs text-zinc-500 mt-1">Gemini Vision est\u00e1 leyendo tu foto</p>
                        </div>
                    )}

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
                            <div className="py-4 text-center">
                                <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            </div>
                        )}

                        {results.length === 0 && search.length >= 2 && !aiLoading && (
                            <div className="py-8 text-center glass-card border-dashed border-zinc-800">
                                <p className="text-sm text-zinc-500 mb-4">No encontramos este alimento...</p>
                                <button
                                    onClick={handleAISearch}
                                    className="px-6 py-3 bg-linear-to-r from-violet-600 to-blue-600 text-white font-black rounded-full text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 mx-auto shadow-lg shadow-violet-500/20"
                                >
                                    <span>✨ Consultar con IA</span>
                                </button>
                            </div>
                        )}

                        {aiLoading && (
                            <div className="py-12 text-center">
                                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Consultando a Elite Nutrition AI...</p>
                            </div>
                        )}

                        <motion.div layout className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {(search.length > 0 ? results : (activeTab === 'recientes' ? history : savedRecipes)).map((food) => (
                                    <div key={food.id} className="relative group overflow-hidden rounded-2xl">
                                        <div className="absolute inset-y-0 left-0 w-full bg-zinc-900/50 flex items-center pl-6 z-0">
                                            <PlusCircle className="w-6 h-6 text-fuchsia-500/50" />
                                        </div>

                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
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
                                                    if (newFood.porcion_nombre) {
                                                        setUnidad('porcion');
                                                        setGramos(1);
                                                    } else if (newFood.last_cantidad) {
                                                        setGramos(newFood.last_cantidad);
                                                        setUnidad(newFood.last_unidad === 'gramos' ? 'gramos' : 'porcion');
                                                    } else {
                                                        setGramos(100);
                                                        setUnidad('gramos');
                                                    }

                                                    setSearch("");
                                                }}
                                                className={cn(
                                                    "w-full p-2 rounded-xl flex justify-between items-center group active:scale-[0.98] transition-all border border-white/10 backdrop-blur-md",
                                                    food.isAI ? "bg-linear-to-r from-blue-500/5 to-indigo-500/5" : "bg-linear-to-r from-fuchsia-500/5 to-violet-500/5",
                                                    !food.isAI && search.length === 0 && "border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-9 h-9 shrink-0 rounded-lg bg-linear-to-br from-violet-600 via-violet-500 to-blue-500 flex items-center justify-center text-lg shadow-xl shadow-violet-500/30">
                                                        {food.isAI ? '🌐' : (food.type === 'recipe' ? '👨‍🍳' : '🍽️')}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-bold text-[13px] flex items-center gap-1.5 leading-tight">
                                                            {food.nombre}
                                                            {food.type === 'recipe' && (
                                                                <span className="px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[7px] font-black uppercase tracking-wider border border-violet-500/30">RECETA</span>
                                                            )}
                                                            {food.isAI && (
                                                                <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[7px] font-black uppercase tracking-wider border border-blue-500/30">WEB</span>
                                                            )}
                                                            {search.length === 0 && !food.isAI && (
                                                                <span className="px-1 py-0.5 rounded bg-zinc-500/20 text-zinc-400 text-[7px] font-black uppercase tracking-wider border border-zinc-500/30">RECIENTE</span>
                                                            )}
                                                        </p>
                                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight mt-0.5">
                                                            {food.type === 'recipe' ? `${food.porciones} porciones` : (food.estado || 'n/a')}
                                                            {food.porcion_nombre && ` • 1 porción = ${food.porcion_gramos}g`}
                                                            {!food.porcion_nombre && food.isAI && ` • por 100g`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full flex items-center justify-center gap-1 transition-all group-hover:scale-105 active:scale-95 shadow-lg",
                                                    food.isAI ? "bg-linear-to-r from-blue-500 to-cyan-500 shadow-blue-500/20" : "bg-linear-to-r from-fuchsia-500 to-violet-500 shadow-fuchsia-500/20"
                                                )}>
                                                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{food.isAI ? 'SCAN' : 'ADD'}</span>
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
                            className="w-full py-4 bg-gradient-to-r from-violet-600/10 to-blue-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all group hover:border-violet-500/40"
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
                        <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 backdrop-blur-sm relative">
                            <Search className="w-8 h-8 text-zinc-500" />
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border border-black">
                                <ChevronDown className="w-3 h-3 text-black" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-extrabold mb-1">{selectedFood.nombre}</h2>
                        <p className="text-zinc-500 font-bold text-sm">Genérico</p>
                        <p className="text-[10px] text-zinc-500 font-bold mt-6 uppercase tracking-[0.2em]">
                            Datos por {gramos} g - peso {selectedFood.estado || 'cocido'}
                        </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'kcal', val: calculateTotal(unidad === 'gramos' ? gramos : (gramos * (selectedFood.porcion_gramos || 100)), Number(selectedFood.kcal)) },
                            { label: 'proteínas', val: `${calculateTotal(unidad === 'gramos' ? gramos : (gramos * (selectedFood.porcion_gramos || 100)), Number(selectedFood.proteinas || 0))} g` },
                            { label: 'carbs', val: `${calculateTotal(unidad === 'gramos' ? gramos : (gramos * (selectedFood.porcion_gramos || 100)), Number(selectedFood.carbohidratos || 0))} g` },
                            { label: 'grasas', val: `${calculateTotal(unidad === 'gramos' ? gramos : (gramos * (selectedFood.porcion_gramos || 100)), Number(selectedFood.grasas || 0))} g` },
                        ].map((stat, i) => (
                            <div key={i} className="bg-violet-500/5 border border-violet-500/10 rounded-2xl py-4 px-1 text-center backdrop-blur-sm">
                                <p className="text-lg font-extrabold mb-0.5">{stat.val}</p>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <button className="w-full py-4 glass-card border-violet-500/20 bg-violet-500/5 flex items-center justify-center gap-2 rounded-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-linear-to-r from-violet-500/20 via-blue-500/20 to-violet-500/20 opacity-40 blur-xl" />
                        <span className="text-violet-400 text-lg relative z-10">✨</span>
                        <span className="text-sm font-extrabold text-white relative z-10 transition-transform group-active:scale-95">Analizar con Elite Coach</span>
                    </button>

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

                    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0614]/90 backdrop-blur-2xl border-t border-violet-500/15 p-6 z-50">
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">
                                    {unidad === 'gramos' ? 'Cantidad' : 'Porciones'}
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
                                                setGramos(Math.round(1 * (selectedFood.porcion_gramos || 100)));
                                            }
                                        } else if (selectedFood.type !== 'recipe') {
                                            // Smart Unit Discovery
                                            setLoadingUnit(true);
                                            try {
                                                const res = await fetch("/api/ai/refine", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ food: selectedFood, action: 'discover-unit' })
                                                });
                                                const discovered = await res.json();
                                                if (discovered.error) throw new Error(discovered.error);

                                                const { id, ...oldFoodWithoutId } = selectedFood;
                                                setSelectedFood({
                                                    ...oldFoodWithoutId,
                                                    ...discovered,
                                                    id: `refined-unit-${Date.now()}`,
                                                    isAI: true
                                                });
                                                setUnidad('porcion');
                                                setGramos(1);
                                            } catch (err) {
                                                console.error("Unit discovery failed:", err);
                                                alert("No pudimos determinar la unidad para este alimento.");
                                            } finally {
                                                setLoadingUnit(false);
                                            }
                                        }
                                    }}
                                    className={cn(
                                        "w-full border rounded-2xl py-4 px-4 text-center font-bold truncate active:scale-95 transition-all capitalize flex items-center justify-center min-h-[58px]",
                                        (selectedFood.porcion_nombre || selectedFood.type !== 'recipe')
                                            ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                                            : "bg-zinc-900/50 border-white/10 text-zinc-500 cursor-not-allowed"
                                    )}
                                >
                                    {loadingUnit ? (
                                        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        unidad === 'gramos' ? 'gramos' : (selectedFood.porcion_nombre || 'unidad')
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

                                        // 3. AI Fallback (Convert state)
                                        try {
                                            const res = await fetch("/api/ai/refine", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ food: selectedFood, action: 'convert-state', targetState: newEstado })
                                            });
                                            const converted = await res.json();
                                            if (converted.error) throw new Error(converted.error);

                                            const { id, ...oldFoodWithoutId } = selectedFood;
                                            setSelectedFood({
                                                ...oldFoodWithoutId,
                                                ...converted,
                                                id: `refined-state-${Date.now()}`,
                                                isAI: true
                                            });
                                        } catch (err) {
                                            console.error("Conversion failed:", err);
                                            alert("No pudimos convertir el estado automáticamente.");
                                        } finally {
                                            setConvertingState(false);
                                        }
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
                                onClick={() => editMode ? router.push(`/?date=${targetDate}`) : setSelectedFood(null)}
                                className="w-16 h-16 bg-red-900/20 border border-red-500/20 rounded-full flex items-center justify-center group active:scale-90 transition-transform"
                            >
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </button>
                            <button
                                onClick={handleAdd}
                                className="flex-1 bg-linear-to-r from-fuchsia-500 to-blue-500 h-16 rounded-full text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-fuchsia-500/20 hover:scale-[1.01] active:scale-95 transition-all"
                            >
                                <span>{editMode ? 'Guardar cambios' : 'Añadir'}</span>
                                <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-1" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
