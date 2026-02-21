"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, Info, Heart, Share2, MoreHorizontal, Trash2, ChevronDown, Flag, PlusCircle, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AddFood() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedFood, setSelectedFood] = useState<any>(null);
    const [gramos, setGramos] = useState(100);
    const [aiLoading, setAiLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newFood, setNewFood] = useState({ nombre: "", kcal: "", proteinas: "", carbohidratos: "", grasas: "", categoria: "Otros" });
    const [creating, setCreating] = useState(false);
    const [scanning, setScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const targetDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const mealType = searchParams.get("meal") || "Almuerzo";

    useEffect(() => {
        if (search.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            // Search food items
            const { data: foodItems } = await supabase
                .from("food_items")
                .select("*")
                .ilike("nombre", `%${search}%`)
                .limit(10);

            // Search recipes
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
    }, [searchParams]);

    const normalizeRecipe = (recipe: any) => {
        const ingredients = recipe.recipe_ingredients || [];
        const portions = recipe.porciones || 1;
        const sums = ingredients.reduce((acc: any, ing: any) => {
            const f = ing.food_items;
            const factor = ing.gramos / 100;
            return {
                kcal: acc.kcal + (Number(f.kcal) * factor),
                proteinas: acc.proteinas + (Number(f.proteinas) * factor),
                carbohidratos: acc.carbohidratos + (Number(f.carbohidratos) * factor),
                grasas: acc.grasas + (Number(f.grasas) * factor),
            };
        }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });

        return {
            ...recipe,
            type: 'recipe',
            kcal: sums.kcal / portions,
            proteinas: sums.proteinas / portions,
            carbohidratos: sums.carbohidratos / portions,
            grasas: sums.grasas / portions,
            estado: `${portions} porciones`
        };
    };

    const fetchRecipe = async (id: string) => {
        const { data, error } = await supabase
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

            // AI results don't have an ID yet, we'll mark them as temporary
            const aiFood = { ...data, isAI: true };
            setSelectedFood(aiFood);
        } catch (err) {
            console.error("AI Search Error:", err);
            alert("No se pudo obtener información de la IA. Verifica tu conexión o API Key.");
        } finally {
            setAiLoading(false);
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

            let targetFoodId = selectedFood.type === 'recipe' ? null : selectedFood.id;
            let targetRecipeId = selectedFood.type === 'recipe' ? selectedFood.id : null;

            // If it's an AI result, persist it to food_items first
            if (selectedFood.isAI) {
                const { data: newFood, error: foodError } = await supabase
                    .from("food_items")
                    .insert({
                        nombre: selectedFood.nombre,
                        categoria: selectedFood.categoria,
                        estado: selectedFood.estado,
                        kcal: selectedFood.kcal,
                        proteinas: selectedFood.proteinas,
                        carbohidratos: selectedFood.carbohidratos,
                        grasas: selectedFood.grasas
                    })
                    .select()
                    .single();

                if (foodError) {
                    console.error("Error creating AI food:", foodError);
                    alert("Error al guardar el nuevo alimento de IA.");
                    return;
                }
                targetFoodId = newFood.id;
            }

            const { error } = await supabase.from("food_logs").insert({
                user_id: user.id,
                food_id: targetFoodId,
                recipe_id: targetRecipeId,
                comida_tipo: (mealType || "Almuerzo") as any,
                gramos: gramos,
                fecha: targetDate
            });

            if (error) {
                console.error("Error inserting food log:", error);
                alert(`Error al guardar: ${error.message}`);
                return;
            }

            router.push("/");
        } catch (err) {
            console.error("Unexpected error:", err);
            alert("Error inesperado. Revisa la consola.");
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
            // Convert file to base64
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
                // If multiple items, we show the first and could later implement a multi-selector
                const bestMatch = data.items[0];
                const scannedFood = {
                    nombre: bestMatch.nombre || "Alimento escaneado",
                    kcal: bestMatch.kcal || 0,
                    proteinas: bestMatch.p || 0,
                    carbohidratos: bestMatch.c || 0,
                    grasas: bestMatch.g || 0,
                    categoria: "Otros",
                    estado: "cocido",
                    isAI: true,
                };
                setSelectedFood(scannedFood);
                setGramos(bestMatch.gramos || 100);
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
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => selectedFood ? setSelectedFood(null) : router.push("/")} className="p-2 -ml-2">
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
                    {/* Hidden file input for camera */}
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
                            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20 active:scale-90 transition-all disabled:opacity-50 shrink-0"
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
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider pl-1">
                            {search.length > 0 ? "Resultados" : "Sugeridos"}
                        </p>
                        {results.length === 0 && search.length >= 2 && !aiLoading && (
                            <div className="py-8 text-center glass-card border-dashed border-zinc-800">
                                <p className="text-sm text-zinc-500 mb-4">No encontramos este alimento...</p>
                                <button
                                    onClick={handleAISearch}
                                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black rounded-full text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 mx-auto shadow-lg shadow-violet-500/20"
                                >
                                    <span>✨ Consultar con IA</span>
                                </button>
                            </div>
                        )}

                        {aiLoading && (
                            <div className="py-12 text-center">
                                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Consultando a Fitia AI...</p>
                            </div>
                        )}

                        {results.map((food) => (
                            <button
                                key={food.id}
                                onClick={() => {
                                    if (food.type === 'recipe') {
                                        setSelectedFood(normalizeRecipe(food));
                                    } else {
                                        setSelectedFood({ ...food, type: 'food' });
                                    }
                                    setSearch("");
                                }}
                                className="w-full glass-card p-4 flex justify-between items-center group active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">{food.type === 'recipe' ? '👨‍🍳' : '🍽️'}</span>
                                    <div className="text-left">
                                        <p className="font-bold flex items-center gap-2">
                                            {food.nombre}
                                            {food.type === 'recipe' && (
                                                <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[8px] font-black uppercase tracking-widest border border-violet-500/20">RECETA</span>
                                            )}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase">
                                            {food.type === 'recipe' ? `${food.porciones} porciones` : (food.estado || 'cocido')}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white">
                                    +
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Create Food Button & Form */}
                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="w-full py-4 glass-card-subtle flex items-center justify-center gap-3 active:scale-[0.98] transition-all group"
                        >
                            <PlusCircle className="w-5 h-5 text-violet-400 transition-transform group-hover:rotate-90" />
                            <span className="text-sm font-bold text-zinc-400 group-hover:text-violet-300 transition-colors">
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
                                    className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
                    {/* Main Info */}
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

                    {/* Macros Grid */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'kcal', val: calculateTotal(gramos, Number(selectedFood.kcal)) },
                            { label: 'proteínas', val: `${calculateTotal(gramos, Number(selectedFood.proteinas || 0))} g` },
                            { label: 'carbs', val: `${calculateTotal(gramos, Number(selectedFood.carbohidratos || 0))} g` },
                            { label: 'grasas', val: `${calculateTotal(gramos, Number(selectedFood.grasas || 0))} g` },
                        ].map((stat, i) => (
                            <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl py-4 px-1 text-center backdrop-blur-sm">
                                <p className="text-lg font-extrabold mb-0.5">{stat.val}</p>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* AI Coach Button */}
                    <button className="w-full py-4 glass-card border-violet-500/20 bg-violet-500/5 flex items-center justify-center gap-2 rounded-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-violet-500/20 opacity-40 blur-xl" />
                        <span className="text-violet-400 text-lg relative z-10">✨</span>
                        <span className="text-sm font-extrabold text-white relative z-10 transition-transform group-active:scale-95">Analizar con Fitia Coach</span>
                    </button>

                    {/* Proportions Bar */}
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

                    {/* Accordions */}
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

                    {/* Fixed Bottom Section */}
                    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0614]/90 backdrop-blur-2xl border-t border-violet-500/15 p-6 z-50">
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Cantidad</label>
                                <input
                                    type="number"
                                    value={gramos}
                                    onChange={(e) => setGramos(Number(e.target.value))}
                                    className="w-full bg-violet-500/5 border border-violet-500/15 rounded-2xl py-4 px-2 text-center text-lg font-extrabold focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
                                />
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Porción</label>
                                <div className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 px-4 text-center font-bold text-zinc-400 truncate">
                                    gramos
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Tipo de Peso</label>
                                <button
                                    onClick={async () => {
                                        const newEstado = selectedFood.estado === 'cocido' ? 'crudo' : 'cocido';
                                        const baseName = selectedFood.nombre.split('(')[0].trim();
                                        const { data } = await supabase
                                            .from("food_items")
                                            .select("*")
                                            .eq("estado", newEstado)
                                            .ilike("nombre", `%${baseName}%`)
                                            .limit(1)
                                            .single();
                                        if (data) setSelectedFood(data);
                                    }}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 px-2 text-center font-extrabold capitalize text-zinc-200"
                                >
                                    {selectedFood.estado || 'cocido'}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedFood(null)}
                                className="w-16 h-16 bg-red-900/20 border border-red-500/20 rounded-full flex items-center justify-center group active:scale-90 transition-transform"
                            >
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </button>
                            <button
                                onClick={handleAdd}
                                className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 h-16 rounded-full text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-violet-500/20 hover:scale-[1.01] active:scale-95 transition-all"
                            >
                                <span>Actualizar</span>
                                <ChevronDown className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
