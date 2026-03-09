"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Layers3, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/navigation/BottomNav";
import { supabase } from "@/lib/supabase";
import { useTemplates } from "@/hooks/useSupabase";

export default function TemplatesPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const { mealTemplates, dayTemplates, loading } = useTemplates(userId || undefined);

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            else router.push("/login");
        }
        initAuth();
    }, [router]);

    return (
        <main className="app-screen text-white px-6 pt-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.push("/week")} className="p-2 rounded-xl bg-white/5 border border-white/10">
                    <ChevronLeft className="w-5 h-5 text-fuchsia-400" />
                </button>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Biblioteca</p>
                    <h1 className="text-2xl font-black tracking-tight">Plantillas</h1>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-8 text-center">
                    <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">Cargando plantillas...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <UtensilsCrossed className="w-5 h-5 text-fuchsia-400" />
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Comidas</h2>
                        </div>
                        <div className="space-y-3">
                            {mealTemplates.length === 0 && (
                                <div className="glass-card p-5 text-sm text-zinc-500">Aún no tienes plantillas de comida.</div>
                            )}
                            {mealTemplates.map((template) => (
                                <div key={template.id} className="glass-card-subtle p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-lg font-black">{template.name}</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 mt-1">{template.meal_type}</p>
                                        </div>
                                        <p className="text-[10px] text-zinc-500">{template.items?.length || 0} items</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Layers3 className="w-5 h-5 text-blue-400" />
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Días</h2>
                        </div>
                        <div className="space-y-3">
                            {dayTemplates.length === 0 && (
                                <div className="glass-card p-5 text-sm text-zinc-500">Aún no tienes plantillas de día.</div>
                            )}
                            {dayTemplates.map((template) => (
                                <div key={template.id} className="glass-card-subtle p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-lg font-black">{template.name}</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 mt-1">{template.day_type}</p>
                                        </div>
                                        <p className="text-[10px] text-zinc-500">{template.items?.length || 0} items</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            <BottomNav />
        </main>
    );
}
