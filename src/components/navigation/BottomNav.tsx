"use client";

import { LayoutGrid, BookOpen, Users, BarChart2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { icon: LayoutGrid, label: "Plan", href: "/" },
        { icon: BookOpen, label: "Recetas", href: "/recipes" },
        { icon: Users, label: "Perfil", href: "/profile" },
        { icon: BarChart2, label: "Progreso", href: "/progress" },
    ];

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 rounded-full bg-[#050510]/80 backdrop-blur-xl border border-fuchsia-500/15 shadow-2xl shadow-fuchsia-900/20 z-50">
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-0.5 px-6 py-2 rounded-full transition-all",
                            isActive
                                ? "bg-linear-to-r from-fuchsia-600 to-blue-600 text-white shadow-lg shadow-fuchsia-500/30"
                                : "text-zinc-500 hover:text-fuchsia-300"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                    </Link>
                );
            })}
            <button className="flex items-center justify-center w-12 h-12 rounded-full bg-linear-to-br from-fuchsia-600 to-blue-600 ml-1 text-white hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-fuchsia-500/30">
                <Zap className="w-6 h-6 fill-white" />
            </button>
        </div>
    );
}
