export type DayType = "training" | "rest" | "free" | "standard";

export interface PlanEntry {
    id: string;
    weekly_plan_id: string;
    plan_date: string;
    meal_type: string;
    food_id: string | null;
    recipe_id: string | null;
    gramos: number;
    original_cantidad: number | null;
    original_unidad: string | null;
    position: number;
    is_completed: boolean;
    day_type?: DayType | null;
    food_items?: any;
    recipes?: any;
}

export interface WeeklyPlan {
    id: string;
    user_id: string;
    week_start: string;
    status: string;
    source_template_id: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface MealTemplate {
    id: string;
    user_id: string;
    name: string;
    meal_type: string;
    created_at?: string;
    updated_at?: string;
    items?: any[];
}

export interface DayTemplate {
    id: string;
    user_id: string;
    name: string;
    day_type: DayType;
    created_at?: string;
    updated_at?: string;
    items?: any[];
}

export interface ShoppingListItem {
    id: string;
    shopping_list_id?: string;
    ingredient_name: string;
    quantity_grams: number;
    is_checked: boolean;
    source_count: number;
}

export const DEFAULT_DAY_TYPES: DayType[] = ["standard", "training", "rest", "free"];

export const getWeekStart = (dateString: string) => {
    const date = new Date(`${dateString}T12:00:00`);
    const weekday = date.getDay();
    const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
    date.setDate(date.getDate() + diffToMonday);
    return date.toISOString().slice(0, 10);
};
