"use client";

import { useRecipe, useProfile } from "@/hooks/useSupabase";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Clock,
    ChevronRight,
    ChefHat,
    Loader2,
    ScrollText,
    UtensilsCrossed,
    X,
    ChevronLeft
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function RecipeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const recipeId = params.id as string;
    const { recipe, loading } = useRecipe(recipeId);
    const [cookingMode, setCookingMode] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                <p className="text-zinc-500 font-medium">Cargando receta...</p>
            </div>
        );
    }

    if (!recipe) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-2">
                    <UtensilsCrossed className="w-8 h-8 text-zinc-600" />
                </div>
                <h1 className="text-xl font-bold text-white">Receta no encontrada</h1>
                <button onClick={() => router.back()} className="text-violet-400 font-bold uppercase tracking-widest text-xs">Volver atrás</button>
            </div>
        );
    }

    const ingredients = recipe.recipe_ingredients || [];
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

    const portionMacros = {
        kcal: Math.round(totals.kcal / recipe.porciones),
        proteinas: (totals.proteinas / recipe.porciones).toFixed(1),
        carbohidratos: (totals.carbohidratos / recipe.porciones).toFixed(1),
        grasas: (totals.grasas / recipe.porciones).toFixed(1),
    };

    return (
        <main className="min-h-screen pb-48 pt-8 px-4 max-w-lg mx-auto">
            <header className="mb-6 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-black text-white truncate">{recipe.nombre}</h1>
            </header>

            <div className="space-y-6">
                {/* Stats Card */}
                <div className="glass-card p-6 border-violet-500/20 bg-gradient-to-br from-violet-600/5 to-transparent">
                    <div className="flex justify-around mb-6">
                        <div className="text-center">
                            <p className="text-3xl font-black text-white">{portionMacros.kcal}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Calorías</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-white">{recipe.porciones}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Porciones</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-zinc-500/10 pt-6">
                        <div className="text-center">
                            <p className="text-xl font-black text-violet-400">{portionMacros.proteinas}g</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase">Proteínas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-black text-blue-400">{portionMacros.carbohidratos}g</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase">Carbos</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-black text-orange-400">{portionMacros.grasas}g</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase">Grasas</p>
                        </div>
                    </div>
                    <p className="mt-4 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest opacity-60 italic">Valores calculados por porción</p>
                </div>

                {/* Ingredients */}
                <section>
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <UtensilsCrossed className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Ingredientes Totales</h2>
                    </div>
                    <div className="space-y-2">
                        {ingredients.map((ing: any, idx: number) => (
                            <div key={idx} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-white font-bold">{ing.food_items.nombre}</p>
                                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                                        {(ing.food_items.kcal * ing.gramos / 100).toFixed(0)} kcal
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-violet-400 font-black">{ing.gramos}g</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="flex gap-4 mt-8">
                    <button
                        onClick={() => setCookingMode(true)}
                        className="flex-1 bg-white/5 border border-violet-500/30 h-16 rounded-2xl flex items-center justify-center gap-3 text-violet-400 font-black text-lg active:scale-95 transition-all"
                    >
                        <ChefHat className="w-6 h-6" />
                        <span>Modo Cocina</span>
                    </button>
                    <Link
                        href={`/add-food?recipeId=${recipe.id}`}
                        className="flex-1 bg-violet-600 h-16 rounded-2xl flex items-center justify-center gap-3 text-white font-black text-lg shadow-xl shadow-violet-500/20 active:scale-95 transition-all"
                    >
                        <span>Registrar</span>
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            {/* Cooking Mode Overlay */}
            {cookingMode && (
                <div className="fixed inset-0 bg-[#050510] z-[100] flex flex-col p-8 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-12">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-500">Paso {currentStep + 1} de {recipe.instrucciones.split('\n').filter((s: string) => s.trim()).length}</p>
                        <button onClick={() => setCookingMode(false)} className="p-2 bg-white/5 rounded-full border border-white/10">
                            <X className="w-6 h-6 text-zinc-500" />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <div className="glass-card p-10 border-violet-500/20 shadow-2xl shadow-violet-500/5 min-h-[300px] flex items-center justify-center">
                            <p className="text-2xl font-black text-center text-white leading-relaxed italic">
                                "{recipe.instrucciones.split('\n').filter((s: string) => s.trim())[currentStep]}"
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-12 pb-8">
                        <button
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 disabled:opacity-20 transition-all active:scale-90"
                        >
                            <ArrowLeft className="w-8 h-8" />
                        </button>
                        <button
                            onClick={() => {
                                const steps = recipe.instrucciones.split('\n').filter((s: string) => s.trim());
                                if (currentStep < steps.length - 1) {
                                    setCurrentStep(prev => prev + 1);
                                } else {
                                    setCookingMode(false);
                                    alert("¡Receta terminada! Espero que haya quedado espectacular.");
                                }
                            }}
                            className="flex-1 h-20 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-violet-500/20 active:scale-95 transition-all"
                        >
                            <span>{currentStep === recipe.instrucciones.split('\n').filter((s: string) => s.trim()).length - 1 ? "Terminar" : "Siguiente"}</span>
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}

            <BottomNav />
        </main>
    );
}
