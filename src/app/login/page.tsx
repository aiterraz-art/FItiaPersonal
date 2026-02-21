"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail, Lock, Loader2 } from "lucide-react";

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/");
        }
    };

    return (
        <main className="min-h-screen bg-black text-white flex flex-col justify-center px-8 font-sans">
            <div className="mb-12">
                <div className="w-16 h-16 bg-gold rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-gold/20">
                    <span className="text-3xl">🔥</span>
                </div>
                <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Bienvenido a <span className="text-gold">Fitia</span></h1>
                <p className="text-zinc-500 font-bold">Inicia sesión para continuar tu progreso.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ejemplo@correo.com"
                            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gold/50 transition-all placeholder:text-zinc-700"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Contraseña</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gold/50 transition-all placeholder:text-zinc-700"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <p className="text-red-500 text-xs font-bold pl-1 animate-in fade-in slide-in-from-top-1">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gold h-16 rounded-full text-black font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-gold/20 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <span>Entrar</span>
                            <ChevronRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-12 text-center">
                <p className="text-zinc-600 text-xs font-bold">
                    ¿No tienes cuenta? <span className="text-gold">Regístrate gratis</span>
                </p>
            </div>

            {/* Decorative Blur */}
            <div className="fixed -top-24 -right-24 w-64 h-64 bg-gold/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="fixed -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        </main>
    );
}
