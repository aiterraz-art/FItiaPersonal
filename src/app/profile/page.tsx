"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Info, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Profile() {
    const router = useRouter();
    const [profile, setProfile] = useState({
        id: "",
        altura: 180,
        peso: 75.2,
        grasa: 15,
        edad: 28,
        sexo: "Masculino",
        meta_kcal: 2650,
        meta_p: 150,
        meta_c: 200,
        meta_g: 60,
        fase: "Pérdida de Grasa",
    });

    useEffect(() => {
        async function getProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (data) {
                setProfile({
                    id: data.id,
                    altura: data.altura_cm,
                    peso: data.peso_kg,
                    grasa: data.porcentaje_grasa,
                    edad: data.edad,
                    sexo: data.sexo,
                    meta_kcal: data.meta_kcal,
                    meta_p: data.meta_p || 150,
                    meta_c: data.meta_c || 200,
                    meta_g: data.meta_g || 60,
                    fase: data.fase,
                });
            } else {
                setProfile(p => ({ ...p, id: user.id }));
            }
        }
        getProfile();
    }, []);

    const handleSave = async () => {
        // Update profile
        const { error: profileError } = await supabase.from("profiles").upsert({
            id: profile.id,
            altura_cm: profile.altura,
            peso_kg: profile.peso,
            porcentaje_grasa: profile.grasa,
            edad: profile.edad,
            sexo: profile.sexo,
            meta_kcal: profile.meta_kcal,
            meta_p: profile.meta_p,
            meta_c: Math.max(0, Math.round((profile.meta_kcal - (profile.meta_p * 4) - (profile.meta_g * 9)) / 4)),
            meta_g: profile.meta_g,
            fase: profile.fase,
            updated_at: new Date().toISOString(),
        });

        if (profileError) {
            console.error("Profile update error:", profileError);
            alert("Error al actualizar el perfil.");
            return;
        }

        // Add weight log entry
        const { error: logError } = await supabase.from("weight_logs").insert({
            user_id: profile.id,
            peso_kg: profile.peso,
            fecha: new Date().toISOString().split("T")[0],
        });

        if (logError) {
            console.error("Weight log error:", logError);
            // We don't block the profile update if logging fails (e.g. table not yet created)
        }

        router.push("/");
    };

    const imc = (profile.peso / ((profile.altura / 100) ** 2)).toFixed(1);
    const ffmi = (profile.peso * (1 - (profile.grasa / 100)) / ((profile.altura / 100) ** 2)).toFixed(1);

    const derivedCarbs = Math.max(0, Math.round((profile.meta_kcal - (profile.meta_p * 4) - (profile.meta_g * 9)) / 4));

    return (
        <main className="min-h-screen bg-black text-white p-6 pb-64">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.push("/")} className="p-2 -ml-2">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">Perfil y Metas</h1>
            </div>

            <div className="space-y-6">
                {/* Datos Físicos */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Datos Físicos</h3>

                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <span className="text-zinc-400 font-medium">Altura</span>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={profile.altura}
                                    onChange={(e) => setProfile({ ...profile, altura: parseInt(e.target.value) })}
                                    className="bg-transparent text-right w-16 font-bold focus:outline-none"
                                />
                                <span className="text-xs text-zinc-500 font-bold">cm</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <span className="text-zinc-400 font-medium">Peso</span>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={profile.peso}
                                    onChange={(e) => setProfile({ ...profile, peso: parseFloat(e.target.value) })}
                                    className="bg-transparent text-right w-16 font-bold focus:outline-none"
                                />
                                <span className="text-xs text-zinc-500 font-bold">kg</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <span className="text-zinc-400 font-medium">% de Grasa</span>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={profile.grasa}
                                    onChange={(e) => setProfile({ ...profile, grasa: parseInt(e.target.value) })}
                                    className="bg-transparent text-right w-16 font-bold focus:outline-none"
                                />
                                <span className="text-xs text-zinc-500 font-bold">%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metas Diarias */}
                <div className="glass-card p-6 border-gold/20 bg-gold/5">
                    <h3 className="text-sm font-bold text-gold/60 uppercase tracking-widest mb-4">Meta Diaria</h3>

                    <div className="flex justify-between items-end border-b border-white/5 pb-4 mb-4">
                        <div>
                            <p className="text-zinc-400 text-xs font-medium mb-1">Calorías Totales</p>
                            <input
                                type="number"
                                value={profile.meta_kcal}
                                onChange={(e) => setProfile({ ...profile, meta_kcal: parseInt(e.target.value) || 0 })}
                                className="bg-transparent text-3xl font-bold focus:outline-none text-gold w-24"
                            />
                        </div>
                        <span className="text-gold/50 font-bold mb-1">kcal</span>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3">
                            <span className="text-zinc-400 font-medium text-sm">Proteínas <span className="text-zinc-500 text-[10px] ml-1 uppercase">(4 kcal/g)</span></span>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={profile.meta_p}
                                    onChange={(e) => setProfile({ ...profile, meta_p: parseInt(e.target.value) || 0 })}
                                    className="bg-transparent text-right w-16 font-bold text-white focus:outline-none"
                                />
                                <span className="text-xs text-zinc-500 font-bold">g</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3">
                            <span className="text-zinc-400 font-medium text-sm">Grasas <span className="text-zinc-500 text-[10px] ml-1 uppercase">(9 kcal/g)</span></span>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={profile.meta_g}
                                    onChange={(e) => setProfile({ ...profile, meta_g: parseInt(e.target.value) || 0 })}
                                    className="bg-transparent text-right w-16 font-bold text-white focus:outline-none"
                                />
                                <span className="text-xs text-zinc-500 font-bold">g</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl px-4 py-3">
                            <span className="text-fuchsia-400 font-medium text-sm flex items-center gap-2">
                                Carbohidratos <span className="text-fuchsia-500/60 text-[10px] uppercase">(Auto)</span>
                            </span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-right w-16 font-black text-fuchsia-400">{derivedCarbs}</span>
                                <span className="text-xs text-fuchsia-500/80 font-bold">g</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cálculos Index */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-5 text-center">
                        <div className="flex justify-center items-center gap-1 mb-1 text-zinc-500">
                            <span className="text-[10px] font-bold uppercase">IMC</span>
                            <Info className="w-3 h-3" />
                        </div>
                        <p className="text-2xl font-bold">{imc}</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Normal</p>
                    </div>
                    <div className="glass-card p-5 text-center">
                        <div className="flex justify-center items-center gap-1 mb-1 text-zinc-500">
                            <span className="text-[10px] font-bold uppercase">FFMI</span>
                            <Info className="w-3 h-3" />
                        </div>
                        <p className="text-2xl font-bold">{ffmi}</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Óptimo</p>
                    </div>
                </div>

                {/* Fase Selector */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Fase Actual</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {["Pérdida de Grasa", "Mantenimiento", "Ganancia Muscular"].map((fase) => (
                            <button
                                key={fase}
                                onClick={() => setProfile({ ...profile, fase: fase })}
                                className={cn(
                                    "w-full py-4 px-6 rounded-2xl text-left font-bold transition-all border",
                                    profile.fase === fase
                                        ? "bg-white text-black border-white"
                                        : "bg-transparent text-zinc-500 border-white/5"
                                )}
                            >
                                {fase}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                className="fixed bottom-32 left-6 right-6 py-4 bg-gold text-black font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-gold/10 active:scale-95 transition-transform"
            >
                <Save className="w-5 h-5" />
                Guardar Cambios
            </button>

            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    router.push("/login");
                }}
                className="fixed bottom-12 left-6 right-6 py-4 bg-zinc-900 border border-white/5 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                Cerrar Sesión
            </button>
        </main>
    );
}
