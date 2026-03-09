"use client";

import { LayoutGrid, BookOpen, Users, BarChart2, Zap } from "lucide-react";
import { cn, getTodayLocalDate } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
    const pathname = usePathname();
    const quickAddHref = `/add-food?date=${getTodayLocalDate()}&meal=${encodeURIComponent("Almuerzo")}`;

    const navItems = [
        { icon: LayoutGrid, label: "Plan", href: "/" },
        { icon: BookOpen, label: "Recetas", href: "/recipes" },
        { icon: Users, label: "Perfil", href: "/profile" },
        { icon: BarChart2, label: "Progreso", href: "/progress" },
    ];

    return (
        <div
            className="fixed left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 rounded-full bg-[rgba(12,8,24,0.82)] backdrop-blur-xl border border-fuchsia-500/20 shadow-2xl shadow-fuchsia-900/30 z-50"
            style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-0.5 px-6 py-2 rounded-full transition-all",
                            isActive
                                ? "bg-linear-to-r from-fuchsia-600 via-violet-500 to-cyan-400 text-white shadow-lg shadow-fuchsia-500/35"
                                : "text-zinc-500 hover:text-fuchsia-200"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                    </Link>
                );
            })}
            <Link
                href={quickAddHref}
                aria-label="Agregar alimento"
                className="flex items-center justify-center w-12 h-12 rounded-full bg-linear-to-br from-fuchsia-600 via-violet-500 to-cyan-400 ml-1 text-white hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-fuchsia-500/35"
            >
                <Zap className="w-6 h-6 fill-white" />
            </Link>
        </div>
    );
}
