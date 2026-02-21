"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    Search,
    Plus,
    ArrowLeft,
    Trash2,
    Save,
    Calculator,
    ChevronDown,
    ChevronUp,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function NewRecipePage() {
    const router = useRouter();
    const [nombre, setNombre] = useState("");
    const [porciones, setPorciones] = useState(1);
    const [instrucciones, setInstrucciones] = useState("");
    const [ingredients, setIngredients] = useState<any[]>([]);

    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);

    const calculateTotals = () => {
        return ingredients.reduce((acc, curr) => {
            const factor = curr.gramos / 100;
            return {
                kcal: acc.kcal + (curr.food.kcal * factor),
                proteinas: acc.proteinas + (curr.food.proteinas * factor),
                carbohidratos: acc.carbohidratos + (curr.food.carbohidratos * factor),
                grasas: acc.grasas + (curr.food.grasas * factor),
            };
        }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });
    };

    const totals = calculateTotals();
    const portionMacros = {
        kcal: Math.round(totals.kcal / porciones),
        proteinas: (totals.proteinas / porciones).toFixed(1),
        carbohidratos: (totals.carbohidratos / porciones).toFixed(1),
        grasas: (totals.grasas / porciones).toFixed(1),
    };

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (search.trim().length > 2) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [search]);

    const performSearch = async () => {
        setSearching(true);
        const { data, error } = await supabase
            .from("food_items")
            .select("*")
            .ilike("nombre", `%${search}%`)
            .limit(5);

        if (data) setSearchResults(data);
        setSearching(false);
    };

    const addIngredient = (food: any) => {
        setIngredients([...ingredients, { food, gramos: 100 }]);
        setSearch("");
        setSearchResults([]);
    };

    const updateIngredientGrams = (index: number, grams: number) => {
        const newIngredients = [...ingredients];
        newIngredients[index].gramos = grams;
        setIngredients(newIngredients);
    };

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!nombre.trim()) { alert("Poné un nombre a la receta"); return; }
        if (ingredients.length === 0) { alert("Agregá al menos un ingrediente"); return; }

        setSaving(true);
        try {
            const userId = "demo-user"; // Using demo user

            // 1. Create recipe
            const { data: recipe, error: recipeError } = await supabase
                .from("recipes")
                .insert({
                    user_id: userId,
                    nombre: nombre.trim(),
                    porciones: porciones,
                    instrucciones: instrucciones.trim()
                })
                .select()
                .single();

            if (recipeError) throw recipeError;

            // 2. Create ingredients
            const ingredientInserts = ingredients.map(ing => ({
                recipe_id: recipe.id,
                food_id: ing.food.id,
                gramos: ing.gramos
            }));

            const { error: ingredientsError } = await supabase
                .from("recipe_ingredients")
                .insert(ingredientInserts);

            if (ingredientsError) throw ingredientsError;

            router.push("/recipes");
        } catch (err: any) {
            console.error(err);
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="min-h-screen pb-48 pt-8 px-4 max-w-lg mx-auto">
            <header className="mb-6 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-black text-white">Nueva Receta</h1>
            </header>

            <div className="space-y-6">
                {/* Basic Info */}
                <div className="glass-card p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Nombre de la preparación</label>
                        <input
                            type="text"
                            placeholder="Ej: Pollo con Arroz y Brócoli"
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all font-medium"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Porciones</label>
                            <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setPorciones(Math.max(1, porciones - 1))}
                                    className="px-4 py-3 text-zinc-400 hover:bg-zinc-800 transition-colors"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                <span className="flex-1 text-center text-white font-bold">{porciones}</span>
                                <button
                                    onClick={() => setPorciones(porciones + 1)}
                                    className="px-4 py-3 text-zinc-400 hover:bg-zinc-800 transition-colors"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Totals Summary */}
                <div className="relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-blue-600/10 opacity-50 group-hover:opacity-100 transition-opacity rounded-3xl" />
                    <div className="relative glass-card p-5 border-violet-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator className="w-4 h-4 text-violet-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Macros por porción</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                                <p className="text-xl font-black text-white">{portionMacros.kcal}</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">kcal</p>
                            </div>
                            <div>
                                <p className="text-xl font-black text-violet-400">{portionMacros.proteinas}g</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">prot</p>
                            </div>
                            <div>
                                <p className="text-xl font-black text-blue-400">{portionMacros.carbohidratos}g</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">carb</p>
                            </div>
                            <div>
                                <p className="text-xl font-black text-orange-400">{portionMacros.grasas}g</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">grasa</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ingredients Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Ingredientes</h3>
                        <span className="text-xs text-zinc-500 font-medium">{ingredients.length} agregados</span>
                    </div>

                    {/* Ingredient Search */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-zinc-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar ingrediente..."
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {searching && (
                            <div className="absolute right-4 inset-y-0 flex items-center">
                                <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                            </div>
                        )}

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full mt-2 left-0 right-0 bg-[#161322] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                                {searchResults.map((food) => (
                                    <button
                                        key={food.id}
                                        onClick={() => addIngredient(food)}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-violet-500/10 border-b border-zinc-800/50 last:border-0 transition-colors text-left"
                                    >
                                        <div className="h-10 w-10 flex-shrink-0 bg-zinc-800 rounded-xl flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold truncate">{food.nombre}</p>
                                            <p className="text-zinc-500 text-xs uppercase tracking-wider">{food.kcal} kcal / 100g</p>
                                        </div>
                                        <Plus className="w-5 h-5 text-violet-500" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ingredients List */}
                    <div className="space-y-2">
                        {ingredients.map((ing, idx) => (
                            <div key={idx} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold truncate">{ing.food.nombre}</p>
                                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                                            {(ing.food.kcal * ing.gramos / 100).toFixed(0)} kcal en total
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => removeIngredient(idx)}
                                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center bg-zinc-950/50 rounded-xl px-4 py-2 border border-zinc-800/50">
                                        <input
                                            type="number"
                                            value={ing.gramos}
                                            onChange={(e) => updateIngredientGrams(idx, Number(e.target.value))}
                                            className="bg-transparent text-white font-bold w-full focus:outline-none"
                                        />
                                        <span className="text-zinc-500 font-bold text-xs ml-2">g</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateIngredientGrams(idx, ing.gramos - 10)} className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 transition-colors">-</button>
                                        <button onClick={() => updateIngredientGrams(idx, ing.gramos + 10)} className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 transition-colors">+</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || ingredients.length === 0}
                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600 h-16 rounded-2xl flex items-center justify-center gap-3 text-white font-black text-lg shadow-xl shadow-violet-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                    {saving ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <Save className="w-6 h-6" />
                            <span>Guardar Receta</span>
                        </>
                    )}
                </button>
            </div>
            <BottomNav />
        </main>
    );
}
