"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Camera, Ruler, Trash2, Calendar, LayoutGrid, Maximize2, Plus, Zap } from "lucide-react";
import { cn, getTodayLocalDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/navigation/BottomNav";

type VaultTab = "Fotos" | "Medidas";

export default function Vault() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<VaultTab>("Fotos");
    const [loading, setLoading] = useState(true);
    const [photos, setPhotos] = useState<any[]>([]);
    const [measurements, setMeasurements] = useState<any[]>([]);

    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showMeasureModal, setShowMeasureModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        async function initAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                fetchVaultData(user.id);
            } else {
                router.push("/login");
            }
        }
        initAuth();
    }, [router]);

    const fetchVaultData = async (uid: string) => {
        setLoading(true);
        // Fetch Photos
        const { data: photoData } = await supabase
            .from("progress_photos")
            .select("*")
            .eq("user_id", uid)
            .order("fecha", { ascending: false });

        // Fetch Measurements
        const { data: measureData } = await supabase
            .from("body_measurements")
            .select("*")
            .eq("user_id", uid)
            .order("fecha", { ascending: false });

        if (photoData) setPhotos(photoData);
        if (measureData) setMeasurements(measureData);
        setLoading(false);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Math.random()}.${fileExt}`;
            const filePath = `progress/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('fitness_assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('fitness_assets')
                .getPublicUrl(filePath);

            // 3. Save to DB
            const { error: dbError } = await supabase
                .from('progress_photos')
                .insert({
                    user_id: userId,
                    photo_url: publicUrl,
                    tipo: 'frente', // Default, could let user chooses
                    fecha: getTodayLocalDate()
                });

            if (dbError) throw dbError;

            fetchVaultData(userId);
            alert("Foto guardada correctamente.");
        } catch (err: any) {
            console.error("Upload error:", err);
            alert("Error al subir foto: " + err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <main className="min-h-screen bg-black text-white p-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/progress")} className="p-2 -ml-2 bg-white/5 rounded-full border border-white/10">
                        <ChevronLeft className="w-5 h-5 text-fuchsia-400" />
                    </button>
                    <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                        VAULT PRO
                    </h1>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">
                    Privado
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5 mb-8">
                {['Fotos', 'Medidas'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as VaultTab)}
                        className={cn(
                            "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            activeTab === tab
                                ? "bg-gradient-to-r from-fuchsia-600 to-blue-600 text-white shadow-lg shadow-fuchsia-500/20"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {tab === "Fotos" ? <Camera className="w-4 h-4" /> : <Ruler className="w-4 h-4" />}
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === "Fotos" ? (
                <div className="space-y-6">
                    {/* Action Card */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="glass-card p-12 flex flex-col items-center justify-center gap-4 border-dashed border-fuchsia-500/30 bg-fuchsia-500/5 cursor-pointer active:scale-95 transition-all"
                    >
                        <div className="w-16 h-16 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30">
                            <Plus className="w-8 h-8 text-fuchsia-400" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Capturar Progreso</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Photo Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {photos.length === 0 && !loading && (
                            <p className="col-span-2 text-center text-zinc-600 py-10 text-sm italic">No hay fotos registradas aún.</p>
                        )}
                        {photos.map((photo) => (
                            <div key={photo.id} className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                                <img src={photo.photo_url} alt="Progress" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4">
                                    <p className="text-[10px] font-black uppercase text-fuchsia-400 tracking-widest">{photo.fecha}</p>
                                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{photo.tipo}</p>
                                </div>
                                <button className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Measurements List */}
                    <button
                        onClick={() => alert("Próximamente: Formulario de medidas")}
                        className="w-full py-5 bg-gradient-to-r from-blue-600 to-fuchsia-600 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-fuchsia-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <Plus className="w-4 h-4" /> Registrar Medidas
                    </button>

                    <div className="space-y-4">
                        {measurements.length === 0 && !loading && (
                            <p className="text-center text-zinc-600 py-10 text-sm italic">No hay medidas registradas aún.</p>
                        )}
                        {measurements.map((m) => (
                            <div key={m.id} className="glass-card p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-black text-white">{m.fecha}</span>
                                    </div>
                                    <Trash2 className="w-4 h-4 text-zinc-600 hover:text-red-400 transition-colors" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: "Peso", val: m.peso_kg, unit: "kg" },
                                        { label: "Cintura", val: m.cintura_cm, unit: "cm" },
                                        { label: "Brazo", val: m.brazo_cm, unit: "cm" },
                                        { label: "Pecho", val: m.pecho_cm, unit: "cm" },
                                        { label: "Pierna", val: m.pierna_cm, unit: "cm" },
                                        { label: "Cuello", val: m.cuello_cm, unit: "cm" },
                                    ].map((field) => (
                                        <div key={field.label} className="text-center">
                                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">{field.label}</p>
                                            <p className="text-lg font-black text-fuchsia-400">
                                                {field.val || "--"} <span className="text-[9px] text-zinc-600 font-bold">{field.unit}</span>
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <Zap className="w-8 h-8 text-fuchsia-500 animate-spin" />
                </div>
            )}

            <BottomNav />
        </main>
    );
}
