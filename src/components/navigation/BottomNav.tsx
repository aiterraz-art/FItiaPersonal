"use client";

import { CalendarRange, LayoutGrid, BookOpen, Users, BarChart2, Zap } from "lucide-react";
import { cn, getTodayLocalDate } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
    const pathname = usePathname();
    const quickAddHref = `/add-food?date=${getTodayLocalDate()}&meal=${encodeURIComponent("Almuerzo")}`;

    const navItems = [
        { icon: LayoutGrid, label: "Hoy", href: "/" },
        { icon: CalendarRange, label: "Semana", href: "/week" },
        { icon: BookOpen, label: "Recetas", href: "/recipes" },
        { icon: BarChart2, label: "Progreso", href: "/progress" },
        { icon: Users, label: "Perfil", href: "/profile" },
    ];

    return (
        <div
            className="fixed left-1/2 z-50 flex w-[calc(100vw-1rem)] max-w-md -translate-x-1/2 items-center gap-1 rounded-[28px] border border-fuchsia-500/20 bg-[rgba(12,8,24,0.82)] p-2 shadow-2xl shadow-fuchsia-900/30 backdrop-blur-xl"
            style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        >
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 transition-all sm:px-4",
                            isActive
                                ? "bg-linear-to-r from-fuchsia-600 via-violet-500 to-cyan-400 text-white shadow-lg shadow-fuchsia-500/35"
                                : "text-zinc-500 hover:text-fuchsia-200"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="truncate text-[9px] font-bold uppercase tracking-wide sm:text-[10px]">{item.label}</span>
                    </Link>
                );
            })}
            <Link
                href={quickAddHref}
                aria-label="Agregar alimento"
                className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-fuchsia-600 via-violet-500 to-cyan-400 text-white shadow-lg shadow-fuchsia-500/35 transition-transform hover:scale-110 active:scale-95"
            >
                <Zap className="w-6 h-6 fill-white" />
            </Link>
        </div>
    );
}
