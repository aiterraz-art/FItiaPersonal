"use client";

import { useEffect, useState } from "react";
import { useRecipes, useProfile } from "@/hooks/useSupabase";
import { Plus, BookOpen, ChevronRight, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function RecipesPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const { recipes, loading: recipesLoading, refetch } = useRecipes(userId || undefined);
    const { profile } = useProfile(userId || undefined);

    useEffect(() => {
        async function getAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        }
        getAuth();
    }, []);

    const loading = !userId || recipesLoading;

    const calculatePortionMacros = (recipe: any) => {
        const ingredients = recipe.recipe_ingredients || [];
        const portions = recipe.porciones || 1;

        const totals = ingredients.reduce((acc: any, curr: any) => {
            const food = curr.food_items;
            const factor = curr.gramos / 100;
            return {
                kcal: acc.kcal + (food.kcal * factor),
                proteinas: acc.proteinas + (food.proteinas * factor),
                carbohidratos: acc.carbohidratos + (food.carbohidratos * factor),
                grasas: acc.grasas + (food.grasas * factor),
            };
        }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });

        return {
            kcal: Math.round(totals.kcal / portions),
            proteinas: (totals.proteinas / portions).toFixed(1),
            carbohidratos: (totals.carbohidratos / portions).toFixed(1),
            grasas: (totals.grasas / portions).toFixed(1),
        };
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm("¿Seguro que querés eliminar esta receta?")) return;

        const { error } = await supabase.from("recipes").delete().eq("id", id);
        if (error) {
            alert("Error al eliminar");
        } else {
            refetch();
        }
    };

    return (
        <main className="min-h-screen pb-32 pt-8 px-4 max-w-lg mx-auto">
            <header className="mb-8">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white">Mis Recetas</h1>
                        <p className="text-zinc-500 font-medium">Gestioná tus preparaciones</p>
                    </div>
                </div>
            </header>

            <Link
                href="/recipes/new"
                className="w-full h-16 rounded-2xl border-2 border-dashed border-violet-500/20 flex items-center justify-center gap-3 text-violet-400 hover:bg-violet-500/5 hover:border-violet-500/40 transition-all active:scale-[0.98] mb-8"
            >
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
                    <Plus className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold">Crear nueva receta</span>
            </Link>

            {loading ? (
                <div className="flex flex-col items-center justify-center pt-20 gap-4">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-zinc-500 font-medium animate-pulse">Cargando tus recetas...</p>
                </div>
            ) : recipes.length === 0 ? (
                <div className="bg-zinc-900/50 rounded-3xl p-10 border border-zinc-800 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-zinc-600" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">No tenés recetas todavía</h2>
                    <p className="text-zinc-500 mb-6">Creá preparaciones complejas y calculá sus macros automáticamente.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {recipes.map((recipe) => {
                        const macros = calculatePortionMacros(recipe);
                        return (
                            <div key={recipe.id} className="glass-card overflow-hidden group">
                                <Link href={`/recipes/${recipe.id}`} className="block p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-violet-400 transition-colors">
                                                {recipe.nombre}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                                                    {recipe.porciones} {recipe.porciones === 1 ? 'porción' : 'porciones'}
                                                </span>
                                                <span className="text-zinc-600 text-xs">•</span>
                                                <span className="text-zinc-500 text-xs">
                                                    {recipe.recipe_ingredients.length} ingredientes
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(recipe.id, e)}
                                            className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 border-t border-zinc-500/10 pt-4">
                                        <div className="text-center">
                                            <p className="text-lg font-black text-white">{macros.kcal}</p>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">kcal</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-violet-400">{macros.proteinas}g</p>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">prot</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-blue-400">{macros.carbohidratos}g</p>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">carb</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black text-orange-400">{macros.grasas}g</p>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">grasa</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest gap-2">
                                        VALORES POR PORCIÓN
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
            <BottomNav />
        </main>
    );
}
