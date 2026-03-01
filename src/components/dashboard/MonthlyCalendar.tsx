"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn, formatDateAsLocalISO, getTodayLocalDate } from "@/lib/utils";

interface MonthlyCalendarProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onDateSelect: (date: string) => void;
}

export function MonthlyCalendar({ isOpen, onClose, selectedDate, onDateSelect }: MonthlyCalendarProps) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate + "T12:00:00"));

    useEffect(() => {
        if (isOpen) {
            setViewDate(new Date(selectedDate + "T12:00:00"));
        }
    }, [isOpen, selectedDate]);

    if (!isOpen) return null;

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

    // Adjust for Monday start (0=Monday, 1=Tuesday, ..., 6=Sunday)
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const monthName = new Intl.DateTimeFormat("es", { month: "long" }).format(viewDate);
    const year = viewDate.getFullYear();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: adjustedFirstDay }, (_, i) => i);

    const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const today = getTodayLocalDate();

    const handleDateClick = (day: number) => {
        const d = new Date(currentYear, currentMonth, day, 12, 0, 0);
        onDateSelect(formatDateAsLocalISO(d));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-70 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#050510] rounded-[2.5rem] border border-fuchsia-500/20 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={prevMonth} className="p-2 text-zinc-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-black uppercase tracking-widest text-white">
                        {monthName} <span className="text-fuchsia-500">{year}</span>
                    </h2>
                    <button onClick={nextMonth} className="p-2 text-zinc-400 hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
                        <span key={d} className="text-[10px] font-black text-zinc-600 text-center py-2">
                            {d}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {emptyDays.map((i) => (
                        <div key={`empty-${i}`} />
                    ))}
                    {days.map((day) => {
                        const dateCode = formatDateAsLocalISO(new Date(currentYear, currentMonth, day, 12, 0, 0));
                        const isSelected = dateCode === selectedDate;
                        const isToday = dateCode === today;

                        return (
                            <button
                                key={day}
                                onClick={() => handleDateClick(day)}
                                className={cn(
                                    "aspect-square rounded-2xl flex items-center justify-center text-sm font-bold transition-all active:scale-90",
                                    isSelected
                                        ? "bg-linear-to-r from-fuchsia-600 to-blue-600 text-white shadow-lg shadow-fuchsia-500/30"
                                        : isToday
                                            ? "border border-fuchsia-500/30 text-fuchsia-400"
                                            : "text-zinc-400 hover:bg-white/5"
                                )}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-8 py-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-[0.2em]"
                >
                    <X className="w-4 h-4" /> Cerrar
                </button>
            </div>
        </div>
    );
}
