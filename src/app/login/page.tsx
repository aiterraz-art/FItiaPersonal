"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail, Lock, Loader2 } from "lucide-react";

export default function Login() {
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (isSignUp) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: nombre,
                        }
                    }
                });

                if (signUpError) throw signUpError;
                router.push("/");
                // Si la confirmación de email está desactivada, ir al inicio
                // De lo contrario, dejar el mensaje de éxito
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInError) throw signInError;
                router.push("/");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black text-white flex flex-col justify-center px-8 font-sans">
            <div className="mb-12">
                <div className="w-16 h-16 bg-gold rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-gold/20">
                    <span className="text-3xl">🔥</span>
                </div>
                <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
                    {isSignUp ? "Crear Cuenta" : "Bienvenido a "}
                    {!isSignUp && <span className="text-gold">Fitia</span>}
                </h1>
                <p className="text-zinc-500 font-bold">
                    {isSignUp ? "Únete a la legión del fitness hoy." : "Inicia sesión para continuar tu progreso."}
                </p>
            </div>

            {success ? (
                <div className="bg-zinc-900/50 border border-gold/20 p-8 rounded-3xl text-center space-y-4 animate-in fade-in zoom-in">
                    <div className="text-4xl">📧</div>
                    <h2 className="text-xl font-bold text-gold">¡Registro exitoso!</h2>
                    <p className="text-zinc-400 text-sm">
                        Revisa tu correo para confirmar tu cuenta y poder iniciar sesión.
                    </p>
                    <button
                        onClick={() => { setIsSignUp(false); setSuccess(false); }}
                        className="text-gold font-bold text-sm underline underline-offset-4"
                    >
                        Volver al inicio de sesión
                    </button>
                </div>
            ) : (
                <form onSubmit={handleAuth} className="space-y-6">
                    {isSignUp && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder="Tu nombre"
                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 px-6 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gold/50 transition-all placeholder:text-zinc-700"
                                    required={isSignUp}
                                />
                            </div>
                        </div>
                    )}

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
                                <span>{isSignUp ? "Registrarse" : "Entrar"}</span>
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>
            )}

            <div className="mt-12 text-center">
                <button
                    onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                    className="text-zinc-600 text-xs font-bold"
                >
                    {isSignUp ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
                    <span className="text-gold">{isSignUp ? "Inicia sesión" : "Regístrate gratis"}</span>
                </button>
            </div>

            {/* Decorative Blur */}
            <div className="fixed -top-24 -right-24 w-64 h-64 bg-gold/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="fixed -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        </main>
    );
}
