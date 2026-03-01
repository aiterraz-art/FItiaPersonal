import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDateAsLocalISO(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getTodayLocalDate() {
    return formatDateAsLocalISO(new Date());
}

export function formatCalories(kcal: number) {
    return new Intl.NumberFormat('es-CL').format(Math.round(kcal));
}

export function calculateMacros(gramos: number, base100g: number) {
    return (gramos * base100g) / 100;
}
