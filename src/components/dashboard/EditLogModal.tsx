"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

interface EditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: {
        id: string;
        nombre: string;
        gramos: number;
        kcal: number;
        // We'll need the base kcal per 100g to calculate the preview
        baseKcalPer100g: number;
    } | null;
    onSave: (id: string, newGramos: number) => Promise<void>;
}

export function EditLogModal({ isOpen, onClose, log, onSave }: EditLogModalProps) {
    const [gramos, setGramos] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (log) {
            setGramos(log.gramos);
        }
    }, [log]);

    if (!isOpen || !log) return null;

    const previewKcal = Math.round((log.baseKcalPer100g * gramos) / 100);

    const handleSave = async () => {
        if (gramos <= 0) return;
        setSaving(true);
        try {
            await onSave(log.id, gramos);
            onClose();
        } catch (error) {
            console.error("Save error:", error);
            alert("Error al guardar los cambios.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#050510] rounded-3xl p-8 border border-fuchsia-500/20 shadow-2xl shadow-fuchsia-500/20 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-black bg-linear-to-r from-fuchsia-300 to-blue-300 bg-clip-text text-transparent italic">
                        EDITAR REGISTRO
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-8">
                    <p className="text-sm font-bold text-zinc-400 mb-1">{log.nombre}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white">{previewKcal}</span>
                        <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-2">kcal totales</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] text-fuchsia-400 font-black uppercase tracking-[0.2em] mb-3 block">
                            Cantidad en Gramos
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={gramos}
                                onChange={(e) => setGramos(Number(e.target.value))}
                                className="w-full bg-white/5 border border-fuchsia-500/10 rounded-2xl py-4 px-6 text-xl font-black text-white focus:outline-none focus:border-fuchsia-500/30 transition-all"
                                placeholder="0"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-black italic">GR</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || gramos <= 0}
                        className="w-full py-4 bg-linear-to-r from-fuchsia-600 to-blue-600 rounded-2xl text-white font-black tracking-widest uppercase text-xs shadow-lg shadow-fuchsia-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        GUARDAR CAMBIOS
                    </button>
                </div>
            </div>
        </div>
    );
}
