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
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: nombre,
                        }
                    }
                });

                if (signUpError) throw signUpError;
                // If email confirmation is on, session is null and we show a success state.
                if (data.session) router.push("/");
                else setSuccess(true);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (signInError) throw signInError;
                router.push("/");
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                const lowerMessage = err.message.toLowerCase();
                const message = lowerMessage.includes("failed to fetch")
                    ? "No se pudo conectar al servidor de autenticación. Intenta de nuevo en unos minutos."
                    : lowerMessage.includes("invalid login credentials")
                        ? "Credenciales inválidas. Revisa correo y contraseña."
                        : lowerMessage.includes("email not confirmed")
                            ? "Debes confirmar tu correo antes de iniciar sesión."
                            : err.message;
                setError(message);
            } else {
                setError("No se pudo autenticar. Intenta nuevamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="app-screen relative min-h-screen px-6 py-10 text-white">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
                <div className="glass-card px-6 py-8 sm:px-8">
                    <div className="mb-7 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/35 bg-linear-to-br from-fuchsia-500/25 to-cyan-400/20 text-xl shadow-lg shadow-fuchsia-500/30">
                                ⚡
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Elite Nutrition</p>
                                <h1 className="neon-title text-xl font-extrabold leading-tight">{isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}</h1>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6 grid grid-cols-2 rounded-2xl border border-fuchsia-500/20 bg-black/25 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(false);
                                setError(null);
                            }}
                            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                                !isSignUp ? "btn-neon-primary" : "text-zinc-400"
                            }`}
                        >
                            Entrar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(true);
                                setError(null);
                            }}
                            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                                isSignUp ? "btn-neon-primary" : "text-zinc-400"
                            }`}
                        >
                            Registro
                        </button>
                    </div>

                    {success ? (
                        <div className="glass-card-subtle rounded-2xl border border-fuchsia-500/30 p-6 text-center">
                            <div className="mb-3 text-3xl">📧</div>
                            <h2 className="neon-title text-lg font-black text-fuchsia-300">Registro Exitoso</h2>
                            <p className="mt-2 text-sm text-zinc-300">
                                Revisa tu correo para confirmar tu cuenta y luego iniciar sesión.
                            </p>
                            <button
                                onClick={() => {
                                    setIsSignUp(false);
                                    setSuccess(false);
                                }}
                                className="mt-5 text-xs font-black uppercase tracking-wider text-fuchsia-300 underline decoration-fuchsia-400/40 underline-offset-4"
                            >
                                Volver al inicio
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleAuth} className="space-y-5">
                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        placeholder="Tu nombre"
                                        autoComplete="name"
                                        className="input-neon w-full rounded-2xl py-4 px-4 text-sm font-semibold placeholder:text-zinc-600"
                                        required={isSignUp}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                    Correo Electrónico
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300/70" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ejemplo@correo.com"
                                        autoComplete="email"
                                        className="input-neon w-full rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold placeholder:text-zinc-600"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300/70" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete={isSignUp ? "new-password" : "current-password"}
                                        className="input-neon w-full rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold placeholder:text-zinc-600"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-neon-primary neon-title flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold tracking-tight transition hover:scale-[1.01] active:scale-[0.98] disabled:opacity-55 disabled:scale-100"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>{isSignUp ? "Crear Cuenta" : "Entrar"}</span>
                                        <ChevronRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
