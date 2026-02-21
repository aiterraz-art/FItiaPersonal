import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCalories(kcal: number) {
    return new Intl.NumberFormat('es-CL').format(Math.round(kcal));
}

export function calculateMacros(gramos: number, base100g: number) {
    return (gramos * base100g) / 100;
}
